import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { ShopContext } from "@/server/auth/context";
import type { MemberRole } from "@/server/db/schema";

// Who is looking at orders. Call center agents only see and change the orders assigned to them.
export type OrderViewer = { shopId: string; userId: string; role: MemberRole };

export const viewerOf = (ctx: ShopContext): OrderViewer => ({ shopId: ctx.shop.id, userId: ctx.user.id, role: ctx.role });

export function visibleOrders(v: OrderViewer) {
  return and(eq(schema.orders.shopId, v.shopId), v.role === "agent" ? eq(schema.orders.assignedTo, v.userId) : undefined);
}

// Changing an order: it must be visible to the viewer and not locked (over the plan's limit).
export async function canTouchOrder(v: OrderViewer, orderId: string) {
  return (await db.$count(schema.orders, and(visibleOrders(v), eq(schema.orders.id, orderId), eq(schema.orders.locked, false)))) > 0;
}
