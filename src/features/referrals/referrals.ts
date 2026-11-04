import "server-only";
import { and, count, desc, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { REFERRED_DISCOUNT } from "./discount";

// Store settings → Refer a seller (Zimam): the store's link /r/<slug> leaves a cookie; a store created with it is
// "referred". When the referred store pays its first plan, the referrer's voucher becomes available: 50% off one month of
// the lower of the two monthly prices, taken off the referrer's next plan payment. The referred store gets 10% off its
// first payment.
export const REF_COOKIE = "sc_ref";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function referralLink(slug: string) {
  return `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}/r/${slug}`;
}

// At sign-up: the store that brought this one (never itself)
export async function recordReferral(tx: Tx, newShopId: string, refShopId: string | undefined) {
  if (!refShopId || refShopId === newShopId || !/^[\w-]{1,36}$/.test(refShopId)) return;
  const [ref] = await tx.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.id, refShopId));
  if (!ref) return;
  await tx.update(schema.shops).set({ referredBy: ref.id }).where(eq(schema.shops.id, newShopId));
  await tx.insert(schema.referralVouchers).values({ id: newId(), shopId: ref.id, referredShopId: newShopId });
}

// When a plan request is approved: a used voucher is spent; a referred store's first payment makes its referrer's voucher available
export async function settleReferral(tx: Tx, request: { id: string; shopId: string; planId: string; voucherId: string | null }) {
  if (request.voucherId) await tx.update(schema.referralVouchers).set({ status: "used", usedAt: new Date() }).where(and(eq(schema.referralVouchers.id, request.voucherId), eq(schema.referralVouchers.status, "available")));
  const [plan] = await tx.select({ price: schema.plans.priceMonthly }).from(schema.plans).where(eq(schema.plans.id, request.planId));
  await tx
    .update(schema.referralVouchers)
    .set({ status: "available", value: plan?.price ?? 0, availableAt: new Date() })
    .where(and(eq(schema.referralVouchers.referredShopId, request.shopId), eq(schema.referralVouchers.status, "pending")));
}

// What a new plan request gets off: the referred store's first payment (10%), plus one available voucher not already waiting
// on another request (50% of one month of the lower price)
export async function referralDiscount(shopId: string, plan: { priceMonthly: number }, amount: number) {
  const [shop] = await db.select({ referredBy: schema.shops.referredBy }).from(schema.shops).where(eq(schema.shops.id, shopId));
  let discount = 0;
  if (shop?.referredBy) {
    const [paid] = await db.select({ n: count() }).from(schema.planRequests).where(and(eq(schema.planRequests.shopId, shopId), eq(schema.planRequests.status, "approved")));
    if (!paid.n) discount += Math.round(amount * REFERRED_DISCOUNT);
  }
  const waiting = (await db.select({ id: schema.planRequests.voucherId }).from(schema.planRequests).where(and(eq(schema.planRequests.status, "pending"), isNotNull(schema.planRequests.voucherId)))).map((r) => r.id!);
  const [voucher] = await db
    .select({ id: schema.referralVouchers.id, value: schema.referralVouchers.value })
    .from(schema.referralVouchers)
    .where(and(eq(schema.referralVouchers.shopId, shopId), eq(schema.referralVouchers.status, "available"), waiting.length ? notInArray(schema.referralVouchers.id, waiting) : undefined))
    .orderBy(schema.referralVouchers.availableAt)
    .limit(1);
  const voucherOff = voucher ? Math.floor(Math.min(voucher.value, plan.priceMonthly) / 2) : 0;
  discount += voucherOff;
  return { discount: Math.min(discount, amount), voucherId: voucher && voucherOff > 0 ? voucher.id : null };
}

export async function referralStats(shopId: string) {
  const v = schema.referralVouchers;
  const rows = await db
    .select({ status: v.status, at: v.createdAt, name: schema.shops.name })
    .from(v)
    .innerJoin(schema.shops, eq(schema.shops.id, v.referredShopId))
    .where(eq(v.shopId, shopId))
    .orderBy(desc(v.createdAt));
  const by = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    signups: rows.length,
    paying: rows.filter((r) => r.status !== "pending").length,
    vouchers: { available: by("available"), pending: by("pending"), used: by("used") },
    referrals: rows.slice(0, 50).map((r) => ({ name: r.name, at: r.at.toISOString(), status: r.status })),
  };
}

// Plans page: the discount the next request would get (shown before paying)
export async function nextDiscountPreview(shopId: string) {
  const [shop] = await db.select({ referredBy: schema.shops.referredBy }).from(schema.shops).where(eq(schema.shops.id, shopId));
  const [voucher] = await db
    .select({ value: schema.referralVouchers.value })
    .from(schema.referralVouchers)
    .where(and(eq(schema.referralVouchers.shopId, shopId), inArray(schema.referralVouchers.status, ["available"])))
    .orderBy(schema.referralVouchers.availableAt)
    .limit(1);
  const [paid] = shop?.referredBy ? await db.select({ n: count() }).from(schema.planRequests).where(and(eq(schema.planRequests.shopId, shopId), eq(schema.planRequests.status, "approved"))) : [{ n: 1 }];
  return { firstPayment: Boolean(shop?.referredBy) && !paid.n, voucherValue: voucher?.value ?? null };
}
