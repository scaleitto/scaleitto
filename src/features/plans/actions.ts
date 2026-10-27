"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requirePlatformAdmin, requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { paymentMethods } from "@/server/db/schema";
import { FREE_PLAN } from "@/server/limits";
import { PERIODS, approvePlanRequest, paymentDetails, rejectPlanRequest } from "./billing";
import { pendingRequest } from "./queries";

const requestSchema = z.object({
  planId: z.string().uuid("e:invalid"),
  months: z.coerce.number().refine((n) => (PERIODS as readonly number[]).includes(n), "e:invalid"),
  method: z.enum(paymentMethods, { error: "e:paymentMethod" }),
  receiptUrl: z.string().trim().max(255),
  note: z.string().trim().max(500, "e:invalid"),
});

// The owner asks for a paid plan: transfer + receipt (or WhatsApp), then the platform admin approves.
export async function requestPlan(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("plans/request", async () => {
    const { shop, user } = await requireSection(asLocale(lang), "plans");
    const parsed = requestSchema.safeParse({
      planId: formData.get("planId"),
      months: formData.get("months"),
      method: formData.get("method"),
      receiptUrl: formData.get("receiptUrl") ?? "",
      note: formData.get("note") ?? "",
    });
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const d = parsed.data;
    if (!paymentDetails().methods[d.method]) return { ok: false, error: "checkFields", fieldErrors: { method: "paymentMethod" } };
    // The receipt must be an image this shop uploaded
    if (d.method !== "whatsapp" && !d.receiptUrl.startsWith(`/uploads/${shop.id}/`)) return { ok: false, error: "checkFields", fieldErrors: { receiptUrl: "receipt" } };
    const [plan] = await db.select().from(schema.plans).where(and(eq(schema.plans.id, d.planId), eq(schema.plans.isActive, true)));
    if (!plan || plan.code === FREE_PLAN || plan.priceMonthly <= 0) return { ok: false, error: "invalid" };
    if (await pendingRequest(shop.id)) return { ok: false, error: "requestPending" };
    await db.insert(schema.planRequests).values({
      id: newId(),
      shopId: shop.id,
      planId: plan.id,
      months: d.months,
      amount: plan.priceMonthly * d.months,
      method: d.method,
      receiptUrl: d.method === "whatsapp" ? null : d.receiptUrl,
      note: d.note || null,
      requestedBy: user.id,
    });
    refresh();
    return { ok: true };
  });
}

export async function cancelPlanRequest(lang: string, id: string): Promise<ActionState> {
  return safeAction("plans/cancel", async () => {
    const { shop } = await requireSection(asLocale(lang), "plans");
    await db
      .update(schema.planRequests)
      .set({ status: "cancelled", decidedAt: new Date() })
      .where(and(eq(schema.planRequests.shopId, shop.id), eq(schema.planRequests.id, id), eq(schema.planRequests.status, "pending")));
    refresh();
    return { ok: true };
  });
}

// Platform admin
export async function decidePlanRequest(lang: string, id: string, approve: boolean, note: string): Promise<ActionState> {
  return safeAction("admin/plan-request", async () => {
    await requirePlatformAdmin(asLocale(lang));
    const adminNote = note.trim().slice(0, 500) || null;
    const ok = approve ? await approvePlanRequest(id, adminNote) : await rejectPlanRequest(id, adminNote);
    refresh();
    return ok ? { ok: true } : { ok: false, error: "notFound" };
  });
}
