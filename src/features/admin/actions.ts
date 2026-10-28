"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requirePlatformAdmin } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { limitKeys, type Limits } from "@/server/db/schema";
import { releaseLockedOrders } from "@/features/plans/locked";
import type { CheckStep } from "@/ui/CheckCard";
import { runSystemCheck } from "./system-check";

const admin = (lang: string) => requirePlatformAdmin(asLocale(lang));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "e:invalid");
// Empty → not set; -1 → unlimited
const limitField = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int("e:invalid").min(-1, "e:invalid").max(100_000_000, "e:invalid").nullable());
const limitsFrom = (fd: FormData) => Object.fromEntries(limitKeys.map((k) => [k, fd.get(k) ?? ""]));

// Plan and paid period chosen by the admin (no payment request needed: gifts, corrections…)
export async function setShopPlan(lang: string, shopId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("admin/shop-plan", async () => {
    await admin(lang);
    const parsed = z.object({ planId: z.string().uuid("e:invalid"), expiresOn: z.union([day, z.literal("")]) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
    const [plan] = await db.select({ id: schema.plans.id }).from(schema.plans).where(eq(schema.plans.id, parsed.data.planId));
    if (!plan) return { ok: false, error: "notFound" };
    // The end of the chosen day, Algeria time
    const expires = parsed.data.expiresOn ? new Date(`${parsed.data.expiresOn}T23:59:59+01:00`) : null;
    await db.update(schema.shops).set({ planId: plan.id, planExpiresAt: expires }).where(eq(schema.shops.id, shopId));
    await releaseLockedOrders(shopId);
    refresh();
    return { ok: true };
  });
}

export async function setShopStatus(lang: string, shopId: string, status: "active" | "suspended"): Promise<ActionState> {
  return safeAction("admin/shop-status", async () => {
    await admin(lang);
    await db.update(schema.shops).set({ status: z.enum(["active", "suspended"]).parse(status) }).where(eq(schema.shops.id, shopId));
    refresh();
    return { ok: true };
  });
}

const contractSchema = z
  .object({
    startDate: day,
    endDate: z.union([day, z.literal("")]),
    priceMonthly: z.preprocess((v) => (v === "" ? null : Number(v)), z.number().int("e:invalid").min(0, "e:invalid").nullable()),
    alertThreshold: z.coerce.number().int("e:invalid").min(1, "e:invalid").max(100, "e:invalid"),
    notes: z.string().trim().max(2000, "e:invalid"),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { path: ["endDate"], message: "e:invalid" });

// A negotiated contract: its limits override the plan's, key by key, between its dates
export async function addContract(lang: string, shopId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("admin/contract", async () => {
    await admin(lang);
    const parsed = contractSchema.safeParse({ ...Object.fromEntries(formData), priceMonthly: formData.get("priceMonthly") ?? "", notes: formData.get("notes") ?? "" });
    const limits = z.object(Object.fromEntries(limitKeys.map((k) => [k, limitField]))).safeParse(limitsFrom(formData));
    if (!parsed.success || !limits.success) {
      return { ok: false, error: "checkFields", fieldErrors: { ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)), ...(limits.success ? {} : fieldErrorsFrom(limits.error)) } };
    }
    const d = parsed.data;
    const set = Object.fromEntries(Object.entries(limits.data).filter(([, v]) => v !== null)) as Limits;
    await db.insert(schema.shopContracts).values({ id: newId(), shopId, startDate: d.startDate, endDate: d.endDate || null, limits: set, priceMonthly: d.priceMonthly, alertThreshold: d.alertThreshold, notes: d.notes || null });
    await releaseLockedOrders(shopId);
    refresh();
    return { ok: true };
  });
}

// Ends a contract today (it stays in the history)
export async function endContract(lang: string, shopId: string, contractId: string): Promise<ActionState> {
  return safeAction("admin/contract-end", async () => {
    await admin(lang);
    const yesterday = new Date(Date.now() - 86400_000 + 3600_000).toISOString().slice(0, 10);
    await db.update(schema.shopContracts).set({ endDate: yesterday }).where(and(eq(schema.shopContracts.shopId, shopId), eq(schema.shopContracts.id, contractId)));
    await releaseLockedOrders(shopId);
    refresh();
    return { ok: true };
  });
}

const planSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(80, "e:invalid"),
  priceMonthly: z.coerce.number().int("e:invalid").min(0, "e:invalid").max(10_000_000, "e:invalid"),
  isActive: z.preprocess((v) => v === "on", z.boolean()),
});

// Name, price, limits, features and visibility of a plan (codes stay fixed: "starter" is the free fallback)
export async function updatePlan(lang: string, planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("admin/plan", async () => {
    await admin(lang);
    const parsed = planSchema.safeParse({ name: formData.get("name"), priceMonthly: formData.get("priceMonthly"), isActive: formData.get("isActive") });
    const limits = z.object(Object.fromEntries(limitKeys.map((k) => [k, limitField.refine((v) => v !== null, "e:required")]))).safeParse(limitsFrom(formData));
    if (!parsed.success || !limits.success) {
      return { ok: false, error: "checkFields", fieldErrors: { ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)), ...(limits.success ? {} : fieldErrorsFrom(limits.error)) } };
    }
    const features = formData.getAll("features").map(String).filter((f) => /^[a-z_]{2,40}$/.test(f));
    await db
      .update(schema.plans)
      .set({ name: parsed.data.name, priceMonthly: parsed.data.priceMonthly, isActive: parsed.data.isActive, limits: limits.data as Limits, features })
      .where(eq(schema.plans.id, planId));
    refresh();
    return { ok: true };
  });
}

export async function clearErrorLogs(lang: string): Promise<ActionState> {
  return safeAction("admin/clear-errors", async () => {
    await admin(lang);
    await db.delete(schema.errorLogs);
    refresh();
    return { ok: true };
  });
}

// The full system check (database, uploads, settings, cron, AI), for the platform admin
export async function adminSystemCheck(lang: string): Promise<CheckStep[]> {
  await admin(lang);
  return runSystemCheck();
}
