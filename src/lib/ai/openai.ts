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

export function aiModel() {
  return process.env.OPENAI_MODEL || "gpt-5-mini";
}

export type JsonCompletion<T> = { data: T; model: string; inputTokens: number; outputTokens: number };

export async function jsonCompletion<T>({
  system,
  user,
  schemaName,
  schema,
  timeoutMs = 120_000,
}: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<JsonCompletion<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError("OPENAI_API_KEY is not set");
  const model = aiModel();
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
    max_completion_tokens: 12_000,
  };
  // Reasoning models (gpt-5*, o*) accept a reasoning effort; low keeps generation fast.
  if (/^(gpt-5|o\d)/.test(model)) body.reasoning_effort = "low";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err: unknown) => {
    throw new AiRequestError(err instanceof Error ? err.message : String(err));
  });

  const json = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    model?: string;
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;

  if (!res.ok) throw new AiRequestError(json?.error?.message ?? `OpenAI HTTP ${res.status}`, res.status);
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
