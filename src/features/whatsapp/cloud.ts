import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { metaGraph } from "@/server/meta";

// The platform's WhatsApp Business number (Meta Cloud API). Server settings: WHATSAPP_TOKEN (a system user's
// permanent token), WHATSAPP_PHONE_ID (the number's id), WHATSAPP_APP_SECRET (signs the webhook calls),
// WHATSAPP_VERIFY_TOKEN (any word, typed again in Meta's webhook settings), WHATSAPP_TEMPLATE_PREFIX (default scaleitto_).
export const whatsappConfigured = () => Boolean(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_ID?.trim());
export const templatePrefix = () => process.env.WHATSAPP_TEMPLATE_PREFIX?.trim() || "scaleitto_";

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

// Sends one approved template with its body variables and, for the questions, the two quick-reply buttons' payloads
export async function sendTemplate(to: string, name: string, language: string, params: string[], buttons: string[] = []): Promise<SendResult> {
  const components: unknown[] = [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }];
  buttons.forEach((payload, index) => components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] }));
  try {
    const res = await fetch(`${metaGraph()}/${process.env.WHATSAPP_PHONE_ID?.trim()}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN?.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template: { name, language: { code: language }, components } }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string; code?: number } } | null;
    const id = body?.messages?.[0]?.id;
    if (res.ok && id) return { ok: true, id };
    return { ok: false, error: `${body?.error?.code ?? res.status}: ${body?.error?.message ?? res.statusText}`.slice(0, 200) };
  } catch (err) {
    return { ok: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
  }
}

// Meta signs each webhook call: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body)
export function validWebhookSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
