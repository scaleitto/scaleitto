import "server-only";

// OpenAI client for long generations on shared hosting: requests run in OpenAI's
// *background mode* (Responses API) — we submit, get an id at once, and poll with
// short requests. Nothing on our server waits for the model.
// Configured from the environment: OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL.

export class AiNotConfiguredError extends Error {}

export class AiRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function aiConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

// Tried in this order after OPENAI_MODEL; a model the key cannot use falls through to the next one.
export const DEFAULT_MODELS = ["gpt-6.1-sol", "gpt-6.1-luna", "gpt-6-luna"];

export function aiModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODELS[0];
}

// The configured model first, then the defaults: a mistyped or unavailable
// OPENAI_MODEL falls back instead of breaking generation.
export function modelChain() {
  return [...new Set([aiModel(), ...DEFAULT_MODELS])];
}

const baseUrl = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiNotConfiguredError("OPENAI_API_KEY is not set");
  return key;
}

type ApiError = { message?: string; param?: string | null; code?: string | null };

async function call(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
  }).catch((err: unknown) => {
    throw new AiRequestError(`Could not reach OpenAI: ${err instanceof Error ? err.message : String(err)}`);
  });
  const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: ApiError }) | null;
  return { res, json };
}

const isModelMissing = (status: number, error?: ApiError) =>
  status === 404 || error?.code === "model_not_found" || /model.*(does not exist|not found)/i.test(error?.message ?? "");

// Lists the model IDs this API key can use (for the admin AI check).
export async function listModels(): Promise<string[]> {
  const { res, json } = await call("/models", { timeoutMs: 20_000 });
  if (!res.ok) throw new AiRequestError(json?.error?.message ?? `OpenAI HTTP ${res.status}`, res.status);
  return ((json?.data as { id: string }[] | undefined) ?? []).map((m) => m.id).sort();
}

export type BackgroundRequest = {
  instructions: string;
  user: string;
  /** Image URLs or data: URLs the model should look at (vision). */
  images?: string[];
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
};

// Submits a background generation and returns its id in a second or two.
export async function startBackgroundJson(req: BackgroundRequest): Promise<{ responseId: string; model: string }> {
  const images = req.images ?? [];
  const models = modelChain();
  for (const [m, model] of models.entries()) {
    // Strict JSON schema, images and low reasoning effort first; if the model rejects one of
    // them, retry without just that one (JSON mode + schema in the prompt is still validated later).
    const attempt = { reasoning: /^(gpt-([5-9]|\d\d)|o\d)/.test(model), strict: true, images: images.length > 0 };
    for (let tries = 0; tries < 4; tries++) {
      const body: Record<string, unknown> = {
        model,
        background: true,
        store: true,
        instructions: attempt.strict ? req.instructions : `${req.instructions}\n\nReply with one JSON object that follows this JSON schema exactly:\n${JSON.stringify(req.schema)}`,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: req.user },
              ...(attempt.images ? images.map((url) => ({ type: "input_image", image_url: url, detail: "low" })) : []),
            ],
          },
        ],
        text: { format: attempt.strict ? { type: "json_schema", name: req.schemaName, schema: req.schema, strict: true } : { type: "json_object" } },
        max_output_tokens: req.maxOutputTokens ?? 16_000,
      };
      if (attempt.reasoning) body.reasoning = { effort: "low" };

      const { res, json } = await call("/responses", { method: "POST", body });
      if (res.ok && typeof json?.id === "string") return { responseId: json.id, model };

      const error = json?.error ?? undefined;
      const message = error?.message ?? `OpenAI HTTP ${res.status}`;
      const rejected = `${error?.param ?? ""} ${message}`;
      const tryNextModel = isModelMissing(res.status, error) || (res.status === 400 && /background/i.test(rejected));
      if (tryNextModel && m < models.length - 1) {
        console.warn(`[ai] "${model}" cannot be used (${message}), trying "${models[m + 1]}"`);
        break;
      }
      if (res.status === 400 && attempt.images && /image/i.test(rejected)) attempt.images = false;
      else if (res.status === 400 && attempt.reasoning && /reasoning/i.test(rejected)) attempt.reasoning = false;
      else if (res.status === 400 && attempt.strict && /json_schema|text\.format|format/i.test(rejected)) attempt.strict = false;
      else throw new AiRequestError(message, res.status);
      console.warn(`[ai] ${model} rejected a parameter, retrying: ${message}`);
    }
  }
  throw new AiRequestError("No configured model accepted the request");
}

export type BackgroundResult<T> =
  | { state: "pending" }
  | { state: "done"; data: T; model: string; inputTokens: number; outputTokens: number }
  | { state: "failed"; error: string };

type ResponseObject = {
  status?: string;
  model?: string;
  error?: ApiError | null;
  incomplete_details?: { reason?: string } | null;
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

// One short status check of a background generation.
export async function pollBackgroundJson<T>(responseId: string): Promise<BackgroundResult<T>> {
  const { res, json } = await call(`/responses/${encodeURIComponent(responseId)}`, { timeoutMs: 20_000 });
  if (!res.ok) {
    // Temporary network/server problems: keep waiting; a missing id is final.
    if (res.status === 404) return { state: "failed", error: "OpenAI no longer has this request (expired)" };
    if (res.status >= 500 || res.status === 429) return { state: "pending" };
    return { state: "failed", error: json?.error?.message ?? `OpenAI HTTP ${res.status}` };
  }
  const r = json as ResponseObject;
  if (r.status === "queued" || r.status === "in_progress") return { state: "pending" };
  if (r.status !== "completed") {
    return { state: "failed", error: r.error?.message ?? (r.incomplete_details?.reason ? `Incomplete: ${r.incomplete_details.reason}` : `Status: ${r.status}`) };
  }
  const parts = (r.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []);
  const refusal = parts.find((p) => p.type === "refusal");
  if (refusal) return { state: "failed", error: `Refused: ${refusal.refusal}` };
  const text = parts.filter((p) => p.type === "output_text").map((p) => p.text ?? "").join("");
  try {
    return {
      state: "done",
      data: JSON.parse(text) as T,
      model: r.model ?? "",
      inputTokens: r.usage?.input_tokens ?? 0,
      outputTokens: r.usage?.output_tokens ?? 0,
    };
  } catch {
    return { state: "failed", error: "The model returned invalid JSON" };
  }
}

export type AiCheckStep = { step: "key" | "models" | "background" | "result"; ok: boolean; detail: string };

// Full check from the dashboard: key present, models reachable, and a tiny background
// generation submitted and read back — the exact path landing pages use.
export async function checkAiConnection(): Promise<AiCheckStep[]> {
  const steps: AiCheckStep[] = [];
  if (!aiConfigured()) return [{ step: "key", ok: false, detail: "OPENAI_API_KEY" }];
  steps.push({ step: "key", ok: true, detail: `${process.env.OPENAI_API_KEY!.slice(0, 7)}…` });
  try {
    const models = await listModels();
    const usable = modelChain().filter((m) => models.includes(m));
    steps.push({ step: "models", ok: usable.length > 0, detail: usable.length ? usable.join(", ") : `${modelChain().join(", ")} ∉ [${models.slice(0, 30).join(", ")}]` });
  } catch (err) {
    steps.push({ step: "models", ok: false, detail: err instanceof Error ? err.message : String(err) });
    return steps;
  }
  try {
    const started = await startBackgroundJson({
      instructions: "Reply with JSON only.",
      user: 'Return {"ok": true}.',
      schemaName: "check",
      schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } },
      maxOutputTokens: 200,
    });
    steps.push({ step: "background", ok: true, detail: `${started.model} · ${started.responseId}` });
    // A tiny request finishes in a few seconds; stay under hosting time limits
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const result = await pollBackgroundJson<{ ok?: boolean }>(started.responseId);
      if (result.state === "done") {
        steps.push({ step: "result", ok: result.data.ok === true, detail: `${result.model} · ${result.inputTokens}+${result.outputTokens} tokens` });
        return steps;
      }
      if (result.state === "failed") {
        steps.push({ step: "result", ok: false, detail: result.error });
        return steps;
      }
    }
    steps.push({ step: "result", ok: true, detail: "queued (OpenAI is busy, it will finish in the background)" });
  } catch (err) {
    steps.push({ step: "background", ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
  return steps;
}
