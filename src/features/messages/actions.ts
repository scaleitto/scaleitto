"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { canTouchOrder, viewerOf } from "@/features/orders/access";
import { MAX_MESSAGE, cleanTemplate, defaultTemplates, messageKinds, messageLanguages, type ShopMessages } from "./templates";

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
