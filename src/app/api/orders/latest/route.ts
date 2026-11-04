import { and, eq, max, ne } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getShopContext } from "@/server/auth/context";
import { visibleOrders } from "@/features/orders/access";

// The newest order number this member can see (abandoned checkouts left out): the dashboard polls it to
// sound and show "New order" alerts (Store settings → General → device notifications).
export async function GET() {
  const ctx = await getShopContext();
  if (!ctx) return Response.json({ number: null }, { status: 401 });
  const [row] = await db
    .select({ number: max(schema.orders.number) })
    .from(schema.orders)
    .where(and(visibleOrders({ shopId: ctx.shop.id, userId: ctx.user.id, role: ctx.role }), ne(schema.orders.status, "abandoned")));
  // The other notifications: a buyer who left the checkout (abandoned carts are kept as draft orders)
  const [left] = await db
    .select({ number: max(schema.orders.number) })
    .from(schema.orders)
    .where(and(visibleOrders({ shopId: ctx.shop.id, userId: ctx.user.id, role: ctx.role }), eq(schema.orders.status, "abandoned")));
  return Response.json({ number: row?.number ?? 0, abandoned: left?.number ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
