import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getShopContext } from "@/server/auth/context";
import { canAccess } from "@/lib/permissions";
import { decryptJson } from "@/server/crypto";
import { logError } from "@/server/errors";
import { visibleOrders, viewerOf } from "@/features/orders/access";
import { carrierClient } from "@/features/delivery/platforms";
import type { Credentials } from "@/features/delivery/platforms/types";

// The printable label of a parcel: the courier's own link, or the PDF fetched with the shop's key (Ecotrack).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getShopContext();
  if (!ctx || !canAccess(ctx.role, "orders")) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const [row] = await db
    .select({ shipment: schema.shipments })
    .from(schema.shipments)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.shipments.orderId))
    .where(and(visibleOrders(viewerOf(ctx)), eq(schema.shipments.id, id), eq(schema.orders.locked, false)));
  const shipment = row?.shipment;
  if (!shipment) return new Response("Not found", { status: 404 });
  if (shipment.labelUrl) return Response.redirect(shipment.labelUrl, 302);
  if (!shipment.carrierAccountId) return new Response("Not found", { status: 404 });
  const [account] = await db.select().from(schema.carrierAccounts).where(and(eq(schema.carrierAccounts.shopId, ctx.shop.id), eq(schema.carrierAccounts.id, shipment.carrierAccountId)));
  const client = account ? carrierClient(account.platform, account.baseUrl, decryptJson<Credentials>(account.credentials)) : null;
  if (!client?.label) return new Response("Not found", { status: 404 });
  try {
    const label = await client.label(shipment.trackingNumber);
    if (!label) return new Response("Not found", { status: 404 });
    return new Response(label.body, { headers: { "Content-Type": label.contentType, "Content-Disposition": `inline; filename="${shipment.trackingNumber}.pdf"`, "Cache-Control": "no-store" } });
  } catch (err) {
    await logError("api/label", err);
    return new Response("The delivery company did not answer", { status: 502 });
  }
}
