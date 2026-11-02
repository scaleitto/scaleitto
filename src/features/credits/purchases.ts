import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { chargily } from "@/features/payments/providers";
import { grantCredits } from "./ledger";

// The platform's own Chargily account, for credit packs paid by card (none = the card tab says it is not available)
export function platformChargily() {
  const secretKey = process.env.PLATFORM_CHARGILY_SECRET?.trim();
  if (!secretKey) return null;
  return { keys: { secretKey }, mode: (process.env.PLATFORM_CHARGILY_MODE === "live" ? "live" : "test") as "test" | "live" };
}

// A purchase becomes credits exactly once (webhook, return page and admin can all report it)
export async function approveCreditPurchase(id: string, adminNote: string | null) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.creditPurchases).where(and(eq(schema.creditPurchases.id, id), eq(schema.creditPurchases.status, "pending"))).for("update");
    if (!p) return;
    await tx.update(schema.creditPurchases).set({ status: "paid", adminNote: adminNote?.slice(0, 500) ?? null, decidedAt: new Date() }).where(eq(schema.creditPurchases.id, id));
    await grantCredits(p.shopId, p.credits, "purchase", p.pack, tx);
  });
}

// Back from the card page: ask Chargily how it went
export async function refreshCreditPurchase(shopId: string, id: string) {
  const [p] = await db.select().from(schema.creditPurchases).where(and(eq(schema.creditPurchases.shopId, shopId), eq(schema.creditPurchases.id, id)));
  const gateway = platformChargily();
  if (!p || p.status !== "pending" || p.method !== "card" || !p.providerRef || !gateway) return p?.status ?? null;
  const status = await chargily.status(gateway.keys, gateway.mode, p.providerRef);
  if (status === "paid") await approveCreditPurchase(id, null);
  else if (status === "failed") await db.update(schema.creditPurchases).set({ status: "rejected", decidedAt: new Date() }).where(eq(schema.creditPurchases.id, id));
  return status === "paid" ? "paid" : status === "failed" ? "rejected" : "pending";
}
