import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { OrderStatus } from "./statuses";
import { viewStatuses, type OrderFilters } from "./views";
import { shipmentStatuses, type ShipmentStatus } from "@/server/db/schema";
import { addDays } from "@/lib/time";
import { visibleOrders, type OrderViewer } from "./access";
import { escapeLike } from "@/lib/validation";
import type { CallGuide } from "@/features/ai/prompts";

export const PAGE_SIZE = 25;
const isShipmentStatus = (v: string): v is ShipmentStatus => shipmentStatuses.includes(v as ShipmentStatus);


// The orders of one view of the Orders section with its filters (assignee: a member id, or "none" for orders nobody
// is in charge of). Rows carry their parcel (courier, tracking, stage) and their fake-order risk.
export async function listOrders(viewer: OrderViewer, f: OrderFilters, riskThreshold: number) {
  const o = schema.orders;
  const sh = schema.shipments;
  const filters: (SQL | undefined)[] = [visibleOrders(viewer)];
  const statuses = viewStatuses[f.view];
  if (f.status && (!statuses || statuses.includes(f.status))) filters.push(eq(o.status, f.status));
  else if (statuses) filters.push(inArray(o.status, statuses));
  if (f.view === "risk") filters.push(gte(o.risk, riskThreshold));
  if (f.view === "returns") {
    const back = and(eq(o.status, "shipped"), eq(sh.status, "returning"));
    const returned = eq(o.status, "returned");
    filters.push(
      f.ret === "back" ? back : f.ret === "pending" ? and(returned, isNull(sh.returnReceivedAt)) : f.ret === "received" ? and(returned, isNotNull(sh.returnReceivedAt)) : or(back, returned),
    );
  }
  if (f.stage && isShipmentStatus(f.stage)) filters.push(eq(sh.status, f.stage));
  if (f.wilaya) filters.push(eq(o.wilayaCode, f.wilaya));
  if (f.delivery) filters.push(eq(o.deliveryType, f.delivery));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) filters.push(gte(o.createdAt, new Date(`${f.from}T00:00:00+01:00`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) filters.push(lt(o.createdAt, new Date(`${addDays(f.to, 1)}T00:00:00+01:00`)));
  if (f.assignee === "none") filters.push(isNull(o.assignedTo));
  else if (f.assignee) filters.push(eq(o.assignedTo, f.assignee));
  const term = f.q.trim();
  if (term) {
    const digits = term.replace(/[^\d]/g, "");
    const like_ = `%${escapeLike(term)}%`;
    filters.push(
      or(
        // A locked order's customer cannot be found by name or phone (that would reveal them)
        and(eq(o.locked, false), or(like(o.customerName, like_), digits ? like(o.phone, `%${digits.replace(/^213/, "")}%`) : undefined)),
        /^#?\d+$/.test(term) ? eq(o.number, Number(term.replace("#", ""))) : undefined,
        like(sh.trackingNumber, like_),
      ),
    );
  }
  const where = and(...filters);
  const size = Math.min(200, Math.max(1, f.size));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: o.id,
        number: o.number,
        status: o.status,
        customerName: o.customerName,
        phone: o.phone,
        wilayaCode: o.wilayaCode,
        deliveryType: o.deliveryType,
        total: o.total,
        createdAt: o.createdAt,
        locked: o.locked,
        risk: o.risk,
        assigneeName: schema.users.name,
        shipmentId: sh.id,
        carrierName: sh.carrierName,
        trackingNumber: sh.trackingNumber,
        stage: sh.status,
        labelUrl: sh.labelUrl,
        returnReceivedAt: sh.returnReceivedAt,
        checkedAt: sh.checkedAt,
        carrierPlatform: schema.carrierAccounts.platform,
        // First product of the order, for the list
        // (written as plain SQL: inside a select Drizzle drops table names, which made the columns ambiguous)
        product: sql<string | null>`(select concat(oi.name, ' ×', oi.quantity) from order_items oi where oi.order_id = orders.id limit 1)`,
      })
      .from(o)
      .leftJoin(schema.users, eq(schema.users.id, o.assignedTo))
      .leftJoin(sh, eq(sh.orderId, o.id))
      .leftJoin(schema.carrierAccounts, eq(schema.carrierAccounts.id, sh.carrierAccountId))
      .where(where)
      .orderBy(desc(o.createdAt), desc(o.number))
      .limit(size)
      .offset((Math.max(1, f.page) - 1) * size),
    db.select({ total: count() }).from(o).leftJoin(sh, eq(sh.orderId, o.id)).where(where),
  ]);
  return {
    rows: rows.map((r) => ({
      ...(r.locked ? { ...r, customerName: "", phone: "" } : r),
      // The label: the courier's own link, or our download of the PDF (Ecotrack companies)
      labelHref: r.shipmentId ? (r.labelUrl ?? (r.carrierPlatform === "ecotrack" ? `/api/shipments/${r.shipmentId}/label` : null)) : null,
    })),
    total,
    size,
  };
}

export async function statusCounts(viewer: OrderViewer) {
  const rows = await db.select({ status: schema.orders.status, n: count() }).from(schema.orders).where(visibleOrders(viewer)).groupBy(schema.orders.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>;
}

// Orders still to confirm at or above the store's risk threshold (the "suspicious" view)
export async function riskCount(viewer: OrderViewer, riskThreshold: number) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.orders)
    .where(and(visibleOrders(viewer), inArray(schema.orders.status, viewStatuses.risk!), gte(schema.orders.risk, riskThreshold)));
  return row.n;
}

// Parcels on their way per courier stage (the stage chips of the "at the courier" view)
export async function stageCounts(viewer: OrderViewer) {
  const rows = await db
    .select({ stage: schema.shipments.status, n: count() })
    .from(schema.orders)
    .innerJoin(schema.shipments, eq(schema.shipments.orderId, schema.orders.id))
    .where(and(visibleOrders(viewer), eq(schema.orders.status, "shipped")))
    .groupBy(schema.shipments.status);
  return Object.fromEntries(rows.map((r) => [r.stage, r.n])) as Partial<Record<ShipmentStatus, number>>;
}

// Returns sub-section: parcels on their way back, returned and still at the courier, received by the merchant
export async function returnCounts(viewer: OrderViewer) {
  const o = schema.orders;
  const sh = schema.shipments;
  const [row] = await db
    .select({
      back: sql<number>`sum(case when ${o.status} = 'shipped' and ${sh.status} = 'returning' then 1 else 0 end)`,
      pending: sql<number>`sum(case when ${o.status} = 'returned' and ${sh.returnReceivedAt} is null then 1 else 0 end)`,
      received: sql<number>`sum(case when ${o.status} = 'returned' and ${sh.returnReceivedAt} is not null then 1 else 0 end)`,
    })
    .from(o)
    .leftJoin(sh, eq(sh.orderId, o.id))
    .where(and(visibleOrders(viewer), inArray(o.status, ["shipped", "returned"])));
  const n = (v: unknown) => Number(v ?? 0);
  return { back: n(row?.back), pending: n(row?.pending), received: n(row?.received) };
}

// Parcel tracking: when the automatic check last asked a courier, and how many parcels it follows
export async function trackingOverview(shopId: string) {
  const sh = schema.shipments;
  const [row] = await db
    .select({ last: sql<Date | null>`max(${sh.checkedAt})`, followed: sql<number>`sum(case when ${sh.carrierAccountId} is not null then 1 else 0 end)` })
    .from(sh)
    .innerJoin(schema.orders, eq(schema.orders.id, sh.orderId))
    .where(and(eq(sh.shopId, shopId), eq(schema.orders.status, "shipped")));
  return { last: row?.last ? new Date(row.last) : null, followed: Number(row?.followed ?? 0) };
}

export async function getOrder(viewer: OrderViewer, id: string) {
  const shopId = viewer.shopId;
  const [order] = await db.select().from(schema.orders).where(and(visibleOrders(viewer), eq(schema.orders.id, id)));
  if (!order) return null;
  const [items, events, history, [blocked], [assignee], [landing]] = await Promise.all([
    db.select().from(schema.orderItems).where(and(eq(schema.orderItems.shopId, shopId), eq(schema.orderItems.orderId, id))),
    db
      .select({ event: schema.orderEvents, userName: schema.users.name })
      .from(schema.orderEvents)
      .leftJoin(schema.users, eq(schema.users.id, schema.orderEvents.userId))
      .where(and(eq(schema.orderEvents.shopId, shopId), eq(schema.orderEvents.orderId, id)))
      .orderBy(asc(schema.orderEvents.createdAt)),
    // Every order from the same phone in this shop: a quick trust signal for the call center
    db
      .select({ status: schema.orders.status, n: count() })
      .from(schema.orders)
      .where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.phone, order.phone)))
      .groupBy(schema.orders.status),
    db.select({ n: count() }).from(schema.blockedPhones).where(and(eq(schema.blockedPhones.shopId, shopId), eq(schema.blockedPhones.phone, order.phone))),
    order.assignedTo ? db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, order.assignedTo)) : Promise.resolve([]),
    order.landingPageId
      ? db.select({ title: schema.landingPages.title }).from(schema.landingPages).where(and(eq(schema.landingPages.shopId, shopId), eq(schema.landingPages.id, order.landingPageId)))
      : Promise.resolve([]),
  ]);
  // The ordered products' call guides (for the call center)
  const productIds = [...new Set(items.map((i) => i.productId).filter((v): v is string => Boolean(v)))];
  const guides = productIds.length
    ? await db.select({ id: schema.products.id, name: schema.products.name, callGuide: schema.products.callGuide }).from(schema.products).where(and(eq(schema.products.shopId, shopId), inArray(schema.products.id, productIds)))
    : [];
  const byStatus = Object.fromEntries(history.map((h) => [h.status, h.n])) as Partial<Record<OrderStatus, number>>;
  const phoneStats = {
    orders: history.reduce((sum, h) => sum + h.n, 0),
    delivered: byStatus.delivered ?? 0,
    failed: (byStatus.cancelled ?? 0) + (byStatus.returned ?? 0),
  };
  const detail = { ...order, items, events, phoneStats, phoneBlocked: blocked.n > 0, assigneeName: (assignee as { name: string } | undefined)?.name ?? null,
    landingTitle: (landing as { title: string } | undefined)?.title ?? null,
    extra: Array.isArray(order.extra) ? (order.extra as { label: string; value: string }[]) : [],
    guides: guides.map((g) => ({ product: { id: g.id, name: g.name }, guide: (g.callGuide as CallGuide | null) ?? null })),
  };
  // Locked (over the plan's limit): nothing that identifies the customer leaves the server
  if (order.locked) {
    return { ...detail, customerName: "", phone: "", commune: "", address: null, customerNote: null, extra: [], ip: null, userAgent: null, tracking: null, phoneStats: { orders: 0, delivered: 0, failed: 0 }, phoneBlocked: false };
  }
  return detail;
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function listLeads(shopId: string, page = 1) {
  const l = schema.leads;
  const where = and(eq(l.shopId, shopId), inArray(l.status, ["abandoned", "contacted"]));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: l.id,
        name: l.name,
        phone: l.phone,
        wilayaCode: l.wilayaCode,
        quantity: l.quantity,
        status: l.status,
        updatedAt: l.updatedAt,
        productName: schema.products.name,
        variantTitle: schema.productVariants.title,
      })
      .from(l)
      .leftJoin(schema.products, eq(schema.products.id, l.productId))
      .leftJoin(schema.productVariants, eq(schema.productVariants.id, l.variantId))
      .where(where)
      .orderBy(desc(l.updatedAt))
      .limit(PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(l).where(where),
  ]);
  return { rows, total };
}

// Orders → Protection: the week's suspicious orders and the blocked numbers
export async function protectionOverview(shopId: string, riskThreshold: number) {
  const o = schema.orders;
  const [[suspicious], blocked] = await Promise.all([
    db.select({ n: count() }).from(o).where(and(eq(o.shopId, shopId), gte(o.risk, riskThreshold), gte(o.createdAt, new Date(Date.now() - 7 * 86400_000)))),
    db
      .select({ phone: schema.blockedPhones.phone, reason: schema.blockedPhones.reason, createdAt: schema.blockedPhones.createdAt })
      .from(schema.blockedPhones)
      .where(eq(schema.blockedPhones.shopId, shopId))
      .orderBy(desc(schema.blockedPhones.createdAt))
      .limit(300),
  ]);
  return { suspicious: suspicious.n, blocked };
}
