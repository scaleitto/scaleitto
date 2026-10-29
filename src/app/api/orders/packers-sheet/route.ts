import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getShopContext } from "@/server/auth/context";
import { canAccess } from "@/lib/permissions";
import { logError } from "@/server/errors";
import { viewerOf, visibleOrders } from "@/features/orders/access";
import { buildParcel, parseParcelOptions } from "@/features/delivery/parcel";
import { packersCsv } from "@/features/delivery/packers-sheet";

const MAX_ORDERS = 500;

// The selected orders as a Packers import sheet (CSV). Form fields: ids (repeated), options (JSON), accountId (optional:
// its origin wilaya and saved defaults). Locked orders and orders the viewer cannot see are left out.
export async function POST(req: Request) {
  const ctx = await getShopContext();
  if (!ctx || !canAccess(ctx.role, "orders")) return new Response("Forbidden", { status: 403 });
  try {
    const form = await req.formData();
    const ids = form.getAll("ids").map(String).filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, MAX_ORDERS);
    const accountId = String(form.get("accountId") ?? "");
    let options: unknown = {};
    try {
      options = JSON.parse(String(form.get("options") ?? "{}"));
    } catch {
      // defaults
    }
    const [account] = accountId ? await db.select().from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, ctx.shop.id), eq(schema.carrierAccounts.id, accountId))) : [];
    const orders = ids.length
      ? await db.select().from(schema.orders).where(and(visibleOrders(viewerOf(ctx)), inArray(schema.orders.id, ids), eq(schema.orders.locked, false)))
      : [];
    const items = orders.length ? await db.select().from(schema.orderItems).where(and(eq(schema.orderItems.shopId, ctx.shop.id), inArray(schema.orderItems.orderId, orders.map((o) => o.id)))) : [];
    const parsed = parseParcelOptions(options, account?.options);
    const parcels = orders
      .sort((a, b) => a.number - b.number)
      .map((o) => buildParcel(o, items.filter((i) => i.orderId === o.id), account?.originWilaya ?? 16, parsed));
    const day = new Date().toISOString().slice(0, 10);
    return new Response(packersCsv(parcels), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="packers-${day}.csv"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    await logError("api/packers-sheet", err);
    return new Response("Error", { status: 500 });
  }
}
