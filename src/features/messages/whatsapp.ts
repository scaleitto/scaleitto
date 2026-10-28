import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decryptJson } from "@/server/crypto";
import { metaGraph } from "@/server/meta";
import { intlPhone } from "@/lib/phone";
import type { MessageKind, MessageVars } from "./templates";

// WhatsApp Business API (Meta Cloud API): customer messages sent straight from the order page.
// Messages the store starts must use a template approved by Meta; without one the text is sent as is,
// which Meta only delivers when the customer wrote to the store in the last 24 hours.

type Config = typeof schema.shopWhatsapp.$inferSelect;
export type WaResult = { ok: true; detail: string } | { ok: false; error: string };

export async function whatsappConfig(shopId: string) {
  const [row] = await db.select().from(schema.shopWhatsapp).where(eq(schema.shopWhatsapp.shopId, shopId));
  return row ?? null;
}

async function call(config: Pick<Config, "phoneNumberId" | "token">, path: string, body?: unknown): Promise<WaResult & { json?: Record<string, unknown> }> {
  const token = decryptJson<string>(config.token);
  try {
    const res = await fetch(`${metaGraph()}/${config.phoneNumberId}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string; code?: number } };
    if (!res.ok || json.error) return { ok: false, error: `${json.error?.code ? `#${json.error.code} ` : ""}${json.error?.message ?? `HTTP ${res.status}`}` };
    return { ok: true, detail: "", json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// "Test": the number Meta knows for this phone number ID and token
export async function testWhatsapp(config: Pick<Config, "phoneNumberId" | "token">): Promise<WaResult> {
  const r = await call(config, "?fields=display_phone_number,verified_name");
  if (!r.ok) return r;
  return { ok: true, detail: [r.json?.verified_name, r.json?.display_phone_number].filter(Boolean).join(" · ") };
}

// Sends one message: the situation's template (its {{1}}, {{2}}… filled from the order) or the text itself
export async function sendWhatsapp(config: Config, to: string, kind: MessageKind, text: string, vars: MessageVars): Promise<WaResult & { template?: string }> {
  const template = config.templates[kind];
  const message = template?.name
    ? {
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language || "ar" },
          ...(template.params.length
            ? { components: [{ type: "body", parameters: template.params.map((p) => ({ type: "text", text: vars[p as keyof MessageVars] || "-" })) }] }
            : {}),
        },
      }
    : { type: "text", text: { body: text, preview_url: false } };
  const r = await call(config, "/messages", { messaging_product: "whatsapp", recipient_type: "individual", to: intlPhone(to), ...message });
  if (!r.ok) return r;
  const id = (r.json?.messages as { id?: string }[] | undefined)?.[0]?.id ?? "";
  return { ok: true, detail: id, template: template?.name };
}
