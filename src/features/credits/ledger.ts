import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Kind = (typeof schema.creditKinds)[number];

async function balanceOf(tx: Tx | typeof db, shopId: string) {
  const [row] = await tx.select({ credits: schema.shops.credits }).from(schema.shops).where(eq(schema.shops.id, shopId));
  return row?.credits ?? 0;
}

// Adds credits (trial, purchase, refund, admin) and writes the ledger line
export async function grantCredits(shopId: string, amount: number, kind: Kind, note: string | null = null, tx?: Tx) {
  const run = async (t: Tx) => {
    await t.update(schema.shops).set({ credits: sql`${schema.shops.credits} + ${amount}` }).where(eq(schema.shops.id, shopId));
    await t.insert(schema.creditLedger).values({ id: newId(), shopId, amount, kind, note: note?.slice(0, 200) ?? null, balanceAfter: await balanceOf(t, shopId) });
  };
  if (tx) await run(tx);
  else await db.transaction(run);
}

// Takes credits only when the balance covers them (atomic); false = not enough, nothing taken
export async function spendCredits(shopId: string, amount: number, kind: Kind, note: string | null = null) {
  return db.transaction(async (tx) => {
    const [res] = await tx
      .update(schema.shops)
      .set({ credits: sql`${schema.shops.credits} - ${amount}` })
      .where(and(eq(schema.shops.id, shopId), gte(schema.shops.credits, amount)));
    if (!res.affectedRows) return false;
    await tx.insert(schema.creditLedger).values({ id: newId(), shopId, amount: -amount, kind, note: note?.slice(0, 200) ?? null, balanceAfter: await balanceOf(tx, shopId) });
    return true;
  });
}
