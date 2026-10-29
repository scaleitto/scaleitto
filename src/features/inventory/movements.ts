import "server-only";
import { db, schema } from "@/server/db";
import type { StockReason } from "@/server/db/schema";
import { newId } from "@/server/auth/context";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Movement = { shopId: string; productId: string; variantId?: string | null; delta: number; reason: StockReason; note?: string | null; orderId?: string | null; userId?: string | null };

// Writes stock changes to the movement log (Inventory → history). Called inside the transaction that changes the stock.
export async function logStock(tx: Tx | typeof db, moves: Movement[]) {
  const rows = moves.filter((m) => m.delta !== 0);
  if (!rows.length) return;
  await tx.insert(schema.stockMovements).values(rows.map((m) => ({ id: newId(), ...m, variantId: m.variantId ?? null, note: m.note?.slice(0, 200) ?? null, orderId: m.orderId ?? null, userId: m.userId ?? null })));
}
