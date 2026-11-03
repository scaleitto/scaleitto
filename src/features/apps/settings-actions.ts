"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireSection } from "@/server/auth/context";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import type { ActionState } from "@/lib/action";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { isIp, resolveProtection } from "@/features/checkout/protection-settings";
import { badgeKeys, resolveApps, waNotices, type AppSettings } from "./settings";
import { MAX_RULES } from "./rules";

// The Apps pages' settings (switches, trust badges, quick contact, thank you, fake-order guard, assignment, blacklist)
const shopOf = async (lang: string) => (await requireSection(asLocale(lang), "apps")).shop;

async function updateApps(shopId: string, change: (s: AppSettings) => AppSettings) {
  const [row] = await db.select({ apps: schema.shops.apps }).from(schema.shops).where(eq(schema.shops.id, shopId));
  await db.update(schema.shops).set({ apps: change(resolveApps(row?.apps)) }).where(eq(schema.shops.id, shopId));
}

const on = (fd: FormData, name: string) => fd.get(name) === "on";
const text = (fd: FormData, name: string) => String(fd.get(name) ?? "");

// The apps that are a single switch
export async function saveAppSwitch(lang: string, key: "abandoned" | "scanner" | "customFields" | "wholesale" | "cart", _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/switch", async () => {
    const shop = await shopOf(lang);
    if (key !== "abandoned" && key !== "scanner" && key !== "customFields" && key !== "wholesale" && key !== "cart") return { ok: false, error: "invalid" };
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
      captcha: text(formData, "captcha") as "never",
      captchaFallback: text(formData, "captchaFallback") as "accept",
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

export async function saveTracking(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/tracking", async () => {
    const shop = await shopOf(lang);
    const number = text(formData, "number").trim() ? normalizePhone(text(formData, "number")) : "";
    if (number && !isValidDzPhone(number)) return { ok: false, error: "checkFields", fieldErrors: { number: "phone" } };
    await updateApps(shop.id, (s) => resolveApps({ ...s, tracking: { enabled: on(formData, "enabled"), contact: text(formData, "contact"), number, lookup: text(formData, "lookup") } }));
    refresh();
    return { ok: true };
  });
}

// Apps → Delivery auto assign / Agent auto assign: one rule saved (created or replaced), deleted or switched
const ints = (fd: FormData, name: string) => fd.getAll(name).map(Number).filter((n) => Number.isInteger(n));
const amount = (fd: FormData, name: string) => {
  const v = text(fd, name).trim();
  return v === "" ? null : /^\d{1,9}$/.test(v) ? Number(v) : NaN;
};

export async function saveRule(lang: string, kind: "delivery" | "agent", id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/rule", async () => {
    const shop = await shopOf(lang);
    const ruleId = id ?? crypto.randomUUID();
    const name = text(formData, "name").trim().slice(0, 80);
    const fieldErrors: Record<string, string> = {};
    if (!name) fieldErrors.name = "required";
    const base = { id: ruleId, name, active: on(formData, "active"), wilayas: ints(formData, "wilayas") };
    let rule: Record<string, unknown>;
    if (kind === "delivery") {
      const carrierAccountId = text(formData, "carrierAccountId");
      const [account] = carrierAccountId ? await db.select({ id: schema.carrierAccounts.id }).from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, shop.id), eq(schema.carrierAccounts.id, carrierAccountId))) : [];
      if (!account) fieldErrors.carrierAccountId = "required";
      const minTotal = amount(formData, "minTotal");
      const maxTotal = amount(formData, "maxTotal");
      if (Number.isNaN(minTotal)) fieldErrors.minTotal = "invalid";
      if (Number.isNaN(maxTotal) || (minTotal !== null && maxTotal !== null && maxTotal < minTotal)) fieldErrors.maxTotal = "invalid";
      rule = { ...base, carrierAccountId, minTotal, maxTotal, deliveryType: text(formData, "deliveryType") };
    } else {
      const agentId = text(formData, "agentId");
      const [agent] = agentId ? await db.select({ id: schema.shopMembers.userId }).from(schema.shopMembers).where(and(eq(schema.shopMembers.shopId, shop.id), eq(schema.shopMembers.userId, agentId), eq(schema.shopMembers.role, "agent"))) : [];
      if (!agent) fieldErrors.agentId = "required";
      const wanted = formData.getAll("productIds").map(String).slice(0, 200);
      const own = wanted.length ? (await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, wanted)))).map((p) => p.id) : [];
      rule = { ...base, agentId, productIds: own, from: text(formData, "from"), to: text(formData, "to"), source: text(formData, "source") };
    }
    if (Object.keys(fieldErrors).length) return { ok: false, error: "checkFields", fieldErrors };
    const key = kind === "delivery" ? "deliveryRules" : "agentRules";
    let full = false;
    await updateApps(shop.id, (s) => {
      const list = s[key] as { id: string }[];
      if (!id && list.length >= MAX_RULES) {
        full = true;
        return s;
      }
      const next = id ? list.map((r) => (r.id === id ? rule : r)) : [...list, rule];
      return resolveApps({ ...s, [key]: next });
    });
    if (full) return { ok: false, error: "tooManyRules" };
    refresh();
    return { ok: true };
  });
}

export async function changeRule(lang: string, kind: "delivery" | "agent", id: string, change: "delete" | "on" | "off" | "up"): Promise<ActionState> {
  return safeAction("apps/rule-change", async () => {
    const shop = await shopOf(lang);
    const key = kind === "delivery" ? "deliveryRules" : "agentRules";
    await updateApps(shop.id, (s) => {
      const list = [...(s[key] as { id: string; active: boolean }[])];
      const i = list.findIndex((r) => r.id === id);
      if (i === -1) return s;
      if (change === "delete") list.splice(i, 1);
      else if (change === "up" && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      else if (change === "on" || change === "off") list[i] = { ...list[i], active: change === "on" };
      return resolveApps({ ...s, [key]: list });
    });
    refresh();
    return { ok: true };
  });
}

// Apps → WhatsApp confirmation: the switch, quiet hours, reminder, language, products and the customer notifications
export async function saveWhatsApp(lang: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("apps/whatsapp", async () => {
    const shop = await shopOf(lang);
    const scope = text(formData, "scope");
    const picked = formData.getAll("products").map(String);
    const products =
      scope === "selected"
        ? (await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, shop.id), inArray(schema.products.id, picked.length ? picked : ["-"])))).map((p) => p.id)
        : null;
    if (scope === "selected" && !products?.length) return { ok: false, error: "checkFields", fieldErrors: { products: "required" } };
    await updateApps(shop.id, (s) =>
      resolveApps({
        ...s,
        whatsapp: {
          ...s.whatsapp,
          enabled: on(formData, "enabled"),
          quietFrom: Number(text(formData, "quietFrom")),
          quietTo: Number(text(formData, "quietTo")),
          reminder: on(formData, "reminder"),
          language: text(formData, "language"),
          products,
          notify: Object.fromEntries(waNotices.map((k) => [k, on(formData, `notify_${k}`)])),
        },
      }),
    );
    refresh();
    return { ok: true };
  });
}

// "Connect my WhatsApp number": the request joins the queue (Meta limits how many businesses are onboarded each week)
export async function requestWhatsAppNumber(lang: string): Promise<ActionState> {
  return safeAction("apps/whatsapp-connect", async () => {
    const shop = await shopOf(lang);
    await updateApps(shop.id, (s) => ({ ...s, whatsapp: { ...s.whatsapp, connectRequested: s.whatsapp.connectRequested || new Date().toISOString() } }));
    refresh();
    return { ok: true };
  });
}
