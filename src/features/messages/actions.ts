"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { canTouchOrder, viewerOf } from "@/features/orders/access";
import { encryptJson } from "@/server/crypto";
import { getOrder } from "@/features/orders/queries";
import { MAX_MESSAGE, buildMessageVars, cleanTemplate, defaultTemplates, messageKinds, messageLanguages, placeholders, resolveMessages, type MessageKind, type ShopMessages } from "./templates";
import { sendWhatsapp, testWhatsapp, whatsappConfig } from "./whatsapp";

// The shop's customer messages (owners and managers). A text equal to the default is not stored,
// so changing the language later still brings that language's defaults.
export async function saveMessages(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("messages/save", async () => {
    const { shop, role } = await requireSection(asLocale(lang), "callCenters");
    if (role === "agent") return { ok: false, error: "forbidden" };
    const parsed = z
      .object({ language: z.enum(messageLanguages), ...Object.fromEntries(messageKinds.map((k) => [k, z.string().max(MAX_MESSAGE, "e:invalid")])) })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields" };
    const d = parsed.data as Record<string, string> & { language: ShopMessages["language"] };
    const templates: ShopMessages["templates"] = {};
    for (const k of messageKinds) {
      const text = cleanTemplate(d[k] ?? "");
      if (text && text !== defaultTemplates[d.language][k]) templates[k] = text;
    }
    await db.update(schema.shops).set({ messages: { language: d.language, templates } }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// An agent sent a message from the order page: kept in the order's history
export async function logMessageSent(lang: string, orderId: string, channel: "whatsapp" | "sms" | "copy", text: string): Promise<ActionState> {
  return safeAction("messages/log", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    if (!(await canTouchOrder(viewerOf(ctx), orderId))) return { ok: false, error: "notFound" };
    const label = z.enum(["whatsapp", "sms", "copy"]).parse(channel);
    await db.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: ctx.shop.id, userId: ctx.user.id, type: "message", note: `${label === "whatsapp" ? "WhatsApp" : label === "sms" ? "SMS" : "📋"} · ${text.slice(0, 1000)}` });
    refresh();
    return { ok: true };
  });
}

// ─── WhatsApp Business API ────────────────────────────────

const managers = async (lang: string) => {
  const ctx = await requireSection(asLocale(lang), "apps");
  return ctx.role === "agent" ? null : ctx;
};

const templateSchema = z.object({
  name: z.string().trim().max(512).regex(/^[a-z0-9_]*$/, "e:invalid"),
  language: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/, "e:invalid"),
  params: z.string().trim().max(200),
});

// Saves the phone number ID, the token (kept when left empty) and a template per situation
export async function saveWhatsapp(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("whatsapp/save", async (): Promise<ActionState> => {
    const ctx = await managers(lang);
    if (!ctx) return { ok: false, error: "forbidden" };
    const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
    const token = String(formData.get("token") ?? "").trim();
    if (!/^\d{6,30}$/.test(phoneNumberId)) return { ok: false, error: "checkFields", fieldErrors: { phoneNumberId: "invalid" } };
    const existing = await whatsappConfig(ctx.shop.id);
    if (!token && !existing) return { ok: false, error: "checkFields", fieldErrors: { token: "required" } };
    const templates: Record<string, { name: string; language: string; params: string[] }> = {};
    for (const kind of messageKinds) {
      const parsed = templateSchema.safeParse({ name: formData.get(`${kind}_name`) ?? "", language: formData.get(`${kind}_language`) || "ar", params: formData.get(`${kind}_params`) ?? "" });
      if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: { [`${kind}_name`]: "invalid" } };
      if (!parsed.data.name) continue;
      const params = parsed.data.params.split(/[\s,،]+/).filter(Boolean);
      if (params.some((p) => !(placeholders as readonly string[]).includes(p))) return { ok: false, error: "checkFields", fieldErrors: { [`${kind}_params`]: "invalid" } };
      templates[kind] = { name: parsed.data.name, language: parsed.data.language, params };
    }
    const values = { phoneNumberId, token: token ? encryptJson(token) : existing!.token, templates, active: true };
    await db.insert(schema.shopWhatsapp).values({ shopId: ctx.shop.id, ...values }).onDuplicateKeyUpdate({ set: values });
    refresh();
    return { ok: true };
  });
}

export async function testWhatsappAction(lang: string): Promise<ActionState> {
  return safeAction("whatsapp/test", async () => {
    const ctx = await managers(lang);
    if (!ctx) return { ok: false, error: "forbidden" };
    const config = await whatsappConfig(ctx.shop.id);
    if (!config) return { ok: false, error: "notFound" };
    const r = await testWhatsapp(config);
    return r.ok ? { ok: true, message: r.detail } : { ok: false, error: "appTestFailed", message: r.error };
  });
}

export async function disconnectWhatsapp(lang: string): Promise<ActionState> {
  return safeAction("whatsapp/disconnect", async () => {
    const ctx = await managers(lang);
    if (!ctx) return { ok: false, error: "forbidden" };
    await db.delete(schema.shopWhatsapp).where(eq(schema.shopWhatsapp.shopId, ctx.shop.id));
    refresh();
    return { ok: true };
  });
}

// From the order page: sends the message through the API and keeps it in the order's history
export async function sendWhatsappMessage(lang: string, orderId: string, kind: MessageKind, text: string): Promise<ActionState> {
  return safeAction("whatsapp/send", async () => {
    const ctx = await requireSection(asLocale(lang), "orders");
    const viewer = viewerOf(ctx);
    if (!(await canTouchOrder(viewer, orderId))) return { ok: false, error: "notFound" };
    const k = z.enum(messageKinds).parse(kind);
    const body = z.string().trim().min(1).max(MAX_MESSAGE * 2).parse(text);
    const [config, order, [shop], [shipment]] = await Promise.all([
      whatsappConfig(ctx.shop.id),
      getOrder(viewer, orderId),
      db.select({ name: schema.shops.name, phone: schema.shops.phone, messages: schema.shops.messages }).from(schema.shops).where(eq(schema.shops.id, ctx.shop.id)),
      db.select({ trackingNumber: schema.shipments.trackingNumber }).from(schema.shipments).where(and(eq(schema.shipments.shopId, ctx.shop.id), eq(schema.shipments.orderId, orderId))),
    ]);
    if (!config?.active || !order || order.locked) return { ok: false, error: "notFound" };
    const vars = buildMessageVars(order, shop, shipment?.trackingNumber ?? null, resolveMessages(shop.messages).language);
    const r = await sendWhatsapp(config, order.phone, k, body, vars);
    if (!r.ok) return { ok: false, error: "whatsappFailed", message: r.error };
    const note = r.template ? `WhatsApp API · ${r.template}` : `WhatsApp API · ${body.slice(0, 1000)}`;
    await db.insert(schema.orderEvents).values({ id: newId(), orderId, shopId: ctx.shop.id, userId: ctx.user.id, type: "message", note });
    refresh();
    return { ok: true, message: r.template ?? "" };
  });
}
