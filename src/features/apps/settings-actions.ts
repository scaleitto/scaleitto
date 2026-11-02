"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { isIp, resolveProtection } from "@/features/checkout/protection-settings";
import { badgeKeys, resolveApps, type AppSettings } from "./settings";

// The Apps pages' settings (switches, trust badges, quick contact, thank you, fake-order guard, assignment, blacklist)
const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "apps")).shop;

async function updateApps(shopId: string, change: (s: AppSettings) => AppSettings) {
  const [row] = await db.select({ apps: schema.shops.apps }).from(schema.shops).where(eq(schema.shops.id, shopId));
  await db.update(schema.shops).set({ apps: change(resolveApps(row?.apps)) }).where(eq(schema.shops.id, shopId));
}

const on = (fd: FormData, name: string) => fd.get(name) === "on";
const text = (fd: FormData, name: string) => String(fd.get(name) ?? "");

// The apps that are a single switch
export async function saveAppSwitch(lang: string, key: "abandoned" | "scanner", _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/switch", async () => {
    const shop = await shopOf(lang);
    if (key !== "abandoned" && key !== "scanner") return { ok: false, error: "invalid" };
    await updateApps(shop.id, (s) => ({ ...s, [key]: on(formData, "enabled") }));
    refresh();
    return { ok: true };
  });
}

export async function saveTrustBadges(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/badges", async () => {
    const shop = await shopOf(lang);
    const badges = badgeKeys.map((key) => ({ key, on: on(formData, `${key}.on`), title: text(formData, `${key}.title`), text: text(formData, `${key}.text`) }));
    await updateApps(shop.id, (s) => resolveApps({ ...s, badges }));
    refresh();
    return { ok: true };
  });
}

export async function saveQuickContact(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/contact", async () => {
    const shop = await shopOf(lang);
    const phone = normalizePhone(text(formData, "phone"));
    const whatsapp = normalizePhone(text(formData, "whatsapp"));
    const fieldErrors: Record<string, string> = {};
    if (on(formData, "phoneOn") && !isValidDzPhone(phone)) fieldErrors.phone = "phone";
    if (on(formData, "whatsappOn") && !isValidDzPhone(whatsapp)) fieldErrors.whatsapp = "phone";
    if (Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    await updateApps(shop.id, (s) => ({ ...s, contact: { phoneOn: on(formData, "phoneOn"), phone: phone || "", whatsappOn: on(formData, "whatsappOn"), whatsapp: whatsapp || "" } }));
    refresh();
    return { ok: true };
  });
}

export async function saveThankYou(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/thanks", async () => {
    const shop = await shopOf(lang);
    await updateApps(shop.id, (s) => resolveApps({ ...s, thanks: { title: text(formData, "title"), message: text(formData, "message"), button: text(formData, "button"), redirect: text(formData, "redirect") } }));
    refresh();
    return { ok: true };
  });
}

// Fake OrderGuard: the store's protection settings (shops.protection)
export async function saveOrderGuard(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/guard", async () => {
    const shop = await shopOf(lang);
    const [row] = await db.select({ protection: schema.shops.protection }).from(schema.shops).where(eq(schema.shops.id, shop.id));
    const current = resolveProtection(row?.protection);
    const n = (name: string) => Number(formData.get(name));
    const next = resolveProtection({
      ...current,
      enabled: on(formData, "enabled"),
      maxPerPhonePerDay: n("maxPerPhonePerDay"),
      duplicateHours: n("duplicateHours"),
      blockDuplicates: on(formData, "blockDuplicates"),
      blockBots: on(formData, "blockBots"),
      holdSuspicious: on(formData, "holdSuspicious"),
      useNetwork: on(formData, "useNetwork"),
      riskThreshold: n("riskThreshold"),
      maxQuantity: n("maxQuantity"),
      blockedWords: text(formData, "blockedWords").split(/\n/),
    });
    await db.update(schema.shops).set({ protection: next }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// Agent Auto Assign: how new orders reach the call center
export async function saveAssignMode(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/assign", async () => {
    const shop = await shopOf(lang);
    const mode = z.enum(["manual", "balanced", "on_shift"]).safeParse(formData.get("mode"));
    if (!mode.success) return { ok: false, error: "invalid" };
    await db.update(schema.shops).set({ assignMode: mode.data }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

// Blacklist: blocked connections (IP addresses) live in the protection settings, blocked phones in blocked_phones
export async function setIpBlocked(lang: string, ip: string, blocked: boolean): Promise<ActionState> {
  return safeAction("apps/block-ip", async () => {
    const shop = await shopOf(lang);
    const value = ip.trim().toLowerCase();
    if (!isIp(value)) return { ok: false, error: "checkFields", fieldErrors: { ip: "ip" } };
    const [row] = await db.select({ protection: schema.shops.protection }).from(schema.shops).where(eq(schema.shops.id, shop.id));
    const current = resolveProtection(row?.protection);
    const blockedIps = blocked ? [value, ...current.blockedIps.filter((x) => x !== value)] : current.blockedIps.filter((x) => x !== value);
    await db.update(schema.shops).set({ protection: resolveProtection({ ...current, blockedIps }) }).where(eq(schema.shops.id, shop.id));
    refresh();
    return { ok: true };
  });
}

export async function setPhoneBlockedApp(lang: string, rawPhone: string, blocked: boolean): Promise<ActionState> {
  return safeAction("apps/block-phone", async () => {
    const shop = await shopOf(lang);
    const phone = normalizePhone(rawPhone);
    if (!isValidDzPhone(phone)) return { ok: false, error: "checkFields", fieldErrors: { phone: "phone" } };
    if (blocked) await db.insert(schema.blockedPhones).ignore().values({ shopId: shop.id, phone, reason: null });
    else await db.delete(schema.blockedPhones).where(and(eq(schema.blockedPhones.shopId, shop.id), eq(schema.blockedPhones.phone, phone)));
    refresh();
    return { ok: true };
  });
}
