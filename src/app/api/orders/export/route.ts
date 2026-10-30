import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { getShopContext } from "@/server/auth/context";
import { canAccess } from "@/lib/permissions";
import { logError } from "@/server/errors";
import { wilayaName } from "@/lib/wilayas";
import { getDictionary, asLocale } from "@/i18n";
import { viewerOf } from "@/features/orders/access";
import { listOrders } from "@/features/orders/queries";
import { parseOrderFilters } from "@/features/orders/views";

const cell = (v: string | number | null) => {
  const s = String(v ?? "");
  // Quoted, and never read as a formula by Excel
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

// Export: the orders of the page's tab and filters (up to 5,000) as a CSV for Excel, in the dashboard's language
export async function GET(req: Request) {
  const ctx = await getShopContext();
  if (!ctx || !canAccess(ctx.role, "orders")) return new Response("Forbidden", { status: 403 });
  try {
    const url = new URL(req.url);
    const lang = asLocale(url.searchParams.get("lang") ?? ctx.shop.defaultLocale ?? "ar");
    const t = getDictionary(lang);
    const f = { ...parseOrderFilters(Object.fromEntries(url.searchParams)), page: 1, size: 5000 };
    const { rows } = await listOrders(viewerOf(ctx), f, 5000);
    const items = rows.length ? await db.select().from(schema.orderItems).where(and(eq(schema.orderItems.shopId, ctx.shop.id), inArray(schema.orderItems.orderId, rows.map((r) => r.id)))) : [];
    const c = t.orderPage.cols;
    const head = [c.id, t.orderPage.dateRange, c.status, c.client, t.orderPage.phone, t.orderPage.wilaya, t.orderPage.commune, c.type, c.product, c.qty, c.amount, c.delivery, c.note];
    const lines = rows.map((r) => [
      r.number,
      r.createdAt.toISOString().slice(0, 16).replace("T", " "),
      t.orders.statuses[r.status],
      r.customerName,
      r.phone,
      wilayaName(r.wilayaCode, lang),
      r.commune,
      r.deliveryType === "home" ? t.orderPage.home : t.orderPage.desk,
      items.filter((i) => i.orderId === r.id).map((i) => `${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} ×${i.quantity}`).join(" + "),
      r.pieces,
      r.total,
      r.trackingNumber ? `${r.carrierName ?? ""} ${r.trackingNumber}` : "",
      r.note,
    ]);
    const csv = "﻿" + [head, ...lines].map((l) => l.map(cell).join(",")).join("\r\n");
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${f.status}-${day}.csv"`, "Cache-Control": "no-store" } });
  } catch (err) {
    await logError("api/orders-export", err);
    return new Response("Error", { status: 500 });
  }
}
