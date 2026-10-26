import "server-only";

// Minimal OpenAI Chat Completions client with Structured Outputs (strict JSON schema).
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

export const DEFAULT_MODELS = ["gpt-6.1-sol", "gpt-6-luna"];

export function aiModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODELS[0];
}

// The configured model first, then the defaults: a mistyped or unavailable
// OPENAI_MODEL falls back instead of breaking generation.
function modelChain() {
  return [...new Set([aiModel(), ...DEFAULT_MODELS])];
}

const baseUrl = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

const isModelMissing = (status: number, error?: { message?: string; code?: string | null }) =>
  status === 404 || error?.code === "model_not_found" || /model.*(does not exist|not found)/i.test(error?.message ?? "");

// Lists the model IDs this API key can use (for the admin AI check).
export async function listModels(): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError("OPENAI_API_KEY is not set");
  const res = await fetch(`${baseUrl()}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
  }).catch((err: unknown) => {
    throw new AiRequestError(err instanceof Error ? err.message : String(err));
  });
  const json = (await res.json().catch(() => null)) as { data?: { id: string }[]; error?: { message?: string } } | null;
  if (!res.ok) throw new AiRequestError(json?.error?.message ?? `OpenAI HTTP ${res.status}`, res.status);
  return (json?.data ?? []).map((m) => m.id).sort();
}

export type JsonCompletion<T> = { data: T; model: string; inputTokens: number; outputTokens: number };

export async function jsonCompletion<T>({
  system,
  user,
  schemaName,
  schema,
  images = [],
  timeoutMs = 180_000,
}: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  /** Image URLs or data: URLs the model should look at (vision). */
  images?: string[];
  timeoutMs?: number;
}): Promise<JsonCompletion<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError("OPENAI_API_KEY is not set");
  type ApiResponse = {
    error?: { message?: string; param?: string | null; code?: string | null };
    model?: string;
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;

  const models = modelChain();
  let json: ApiResponse = null;
  let model = models[0];
  modelLoop: for (const [m, candidate] of models.entries()) {
    model = candidate;
    // Reasoning models (gpt-5+, o*) accept a reasoning effort; "low" keeps generation fast and cheap
    // and is valid for every model that supports the parameter.
    // Strict JSON schema first; if the model rejects a parameter, retry without just that one
    // (JSON mode + schema in the prompt still gets validated by the caller).
    const attempt = { reasoningEffort: /^(gpt-([5-9]|\d\d)|o\d)/.test(model), strictSchema: true, images: images.length > 0 };
    for (let tries = 0; ; tries++) {
      const body: Record<string, unknown> = {
        model,
        messages: [
          {
            role: "system",
            content: attempt.strictSchema ? system : `${system}\n\nReply with a single JSON object that follows this JSON schema exactly:\n${JSON.stringify(schema)}`,
          },
          {
          role: "user",
          content: attempt.images
            ? [{ type: "text", text: user }, ...images.map((url) => ({ type: "image_url", image_url: { url, detail: "low" } }))]
            : user,
        },
        ],
        response_format: attempt.strictSchema ? { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } } : { type: "json_object" },
        max_completion_tokens: 12_000,
      };
      if (attempt.reasoningEffort) body.reasoning_effort = "low";

      const res = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      }).catch((err: unknown) => {
        throw new AiRequestError(err instanceof Error ? err.message : String(err));
      });
      json = (await res.json().catch(() => null)) as ApiResponse;
      if (res.ok) break modelLoop;

      const message = json?.error?.message ?? `OpenAI HTTP ${res.status}`;
      if (isModelMissing(res.status, json?.error ?? undefined) && m < models.length - 1) {
        console.warn(`[ai] model "${model}" is not available, trying "${models[m + 1]}": ${message}`);
        continue modelLoop;
      }
      const rejected = `${json?.error?.param ?? ""} ${message}`;
      if (res.status === 400 && tries < 3 && attempt.images && /image/i.test(rejected)) attempt.images = false;
      else if (res.status === 400 && tries < 3 && attempt.reasoningEffort && /reasoning/i.test(rejected)) attempt.reasoningEffort = false;
      else if (res.status === 400 && tries < 3 && attempt.strictSchema && /response_format|json_schema/i.test(rejected)) attempt.strictSchema = false;
      else throw new AiRequestError(message, res.status);
      console.warn(`[ai] ${model} rejected a parameter, retrying: ${message}`);
    }
  }

  const choice = json?.choices?.[0];
  if (choice?.message?.refusal) throw new AiRequestError(`Refused: ${choice.message.refusal}`);
  if (!choice?.message?.content) throw new AiRequestError(`Empty response (finish_reason: ${choice?.finish_reason ?? "unknown"})`);

  let data: T;
  try {
    data = JSON.parse(choice.message.content) as T;
  } catch {
    throw new AiRequestError("The model returned invalid JSON");
  }
  return {
    data,
    model: json?.model ?? model,
    inputTokens: json?.usage?.prompt_tokens ?? 0,
    outputTokens: json?.usage?.completion_tokens ?? 0,
  };
}
