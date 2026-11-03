import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { PENDING_STATUSES, type OrderStatus } from "./statuses";
import type { OrderFilters } from "./views";
import { addDays } from "@/lib/time";
import { visibleOrders, type OrderViewer } from "./access";
import { escapeLike } from "@/lib/validation";

// One status tab of the orders page with its filters. Rows carry what the table shows: the first product (name, photo),
// pieces, the client, the agent, the delivery company and the parcel.
export async function listOrders(viewer: OrderViewer, f: OrderFilters, maxSize = 100) {
  const o = schema.orders;
  const sh = schema.shipments;
  // The pending tab also holds the orders to call back
  const filters: (SQL | undefined)[] = [visibleOrders(viewer), f.status === "pending" ? inArray(o.status, [...PENDING_STATUSES]) : eq(o.status, f.status)];
  if (f.product) filters.push(sql`exists (select 1 from order_items fi where fi.order_id = ${o.id} and fi.product_id = ${f.product})`);
  if (f.agent === "none") filters.push(isNull(o.assignedTo));
  else if (f.agent === "me") filters.push(eq(o.assignedTo, viewer.userId));
  else if (f.agent) filters.push(eq(o.assignedTo, f.agent));
  if (f.wilaya) filters.push(eq(o.wilayaCode, f.wilaya));
  if (f.wa) filters.push(eq(o.whatsapp, f.wa));
  if (f.payment) filters.push(eq(o.paymentMethod, f.payment));
  if (f.from) filters.push(gte(o.createdAt, new Date(`${f.from}T00:00:00+01:00`)));
  if (f.to) filters.push(lt(o.createdAt, new Date(`${addDays(f.to, 1)}T00:00:00+01:00`)));
  const term = f.q;
  if (term) {
    const digits = term.replace(/[^\d]/g, "");
    const like_ = `%${escapeLike(term)}%`;
    filters.push(
      or(
        // A locked order's customer cannot be found by name or phone (that would reveal them)
        and(eq(o.locked, false), or(like(o.customerName, like_), digits.length >= 3 ? like(o.phone, `%${digits.replace(/^213/, "")}%`) : undefined)),
        /^#?\d+$/.test(term) ? eq(o.number, Number(term.replace("#", ""))) : undefined,
        like(sh.trackingNumber, like_),
      ),
    );
  }
  const where = and(...filters);
  const size = Math.min(maxSize, Math.max(1, f.size));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: o.id,
        number: o.number,
        status: o.status,
        createdAt: o.createdAt,
        customerName: o.customerName,
        phone: o.phone,
        wilayaCode: o.wilayaCode,
        commune: o.commune,
        deliveryType: o.deliveryType,
        total: o.total,
        note: o.note,
        locked: o.locked,
        risk: o.risk,
        paymentStatus: o.paymentStatus,
        whatsapp: o.whatsapp,
        assignedTo: o.assignedTo,
        carrierAccountId: o.carrierAccountId,
        shipmentId: sh.id,
        carrierName: sh.carrierName,
        trackingNumber: sh.trackingNumber,
        stage: sh.status,
        // (plain SQL: inside a select Drizzle drops table names, which made the columns ambiguous)
        product: sql<string | null>`(select oi.name from order_items oi where oi.order_id = orders.id order by oi.id limit 1)`,
        image: sql<string | null>`(select json_unquote(json_extract(p.images, '$[0]')) from order_items oi join products p on p.id = oi.product_id where oi.order_id = orders.id order by oi.id limit 1)`,
        pieces: sql<number>`(select coalesce(sum(oi.quantity), 0) from order_items oi where oi.order_id = orders.id)`,
        lines: sql<number>`(select count(*) from order_items oi where oi.order_id = orders.id)`,
      })
      .from(o)
      .leftJoin(sh, eq(sh.orderId, o.id))
      .where(where)
      .orderBy(desc(o.createdAt), desc(o.number))
      .limit(size)
      .offset((Math.max(1, f.page) - 1) * size),
    db.select({ total: count() }).from(o).leftJoin(sh, eq(sh.orderId, o.id)).where(where),
  ]);
  return {
    rows: rows.map((r) => ({ ...(r.locked ? { ...r, customerName: "", phone: "", commune: "" } : r), pieces: Number(r.pieces), lines: Number(r.lines) })),
    total,
    size,
  };
}

// How many orders sit in each status tab
export async function tabCounts(viewer: OrderViewer) {
  const rows = await db.select({ status: schema.orders.status, n: count() }).from(schema.orders).where(visibleOrders(viewer)).groupBy(schema.orders.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>;
}

// One order for the edit dialog: its lines (with the product's photo), the parcel, the agent's automatic choice
export async function getOrder(viewer: OrderViewer, id: string) {
  const shopId = viewer.shopId;
  const [order] = await db.select().from(schema.orders).where(and(visibleOrders(viewer), eq(schema.orders.id, id)));
  if (!order) return null;
  const [items, [blocked], [assignEvent]] = await Promise.all([
    db
      .select({ item: schema.orderItems })
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.shopId, shopId), eq(schema.orderItems.orderId, id))),
    db.select({ n: count() }).from(schema.blockedPhones).where(and(eq(schema.blockedPhones.shopId, shopId), eq(schema.blockedPhones.phone, order.phone))),
    db
      .select({ note: schema.orderEvents.note, at: schema.orderEvents.createdAt })
      .from(schema.orderEvents)
      .where(and(eq(schema.orderEvents.shopId, shopId), eq(schema.orderEvents.orderId, id), eq(schema.orderEvents.type, "assign")))
      .orderBy(desc(schema.orderEvents.createdAt))
      .limit(1),
  ]);
  const detail = { ...order, items: items.map((r) => r.item), phoneBlocked: blocked.n > 0, assignEvent: assignEvent ?? null };
  // Locked (over the plan's limit): nothing that identifies the customer leaves the server
  if (order.locked) return { ...detail, customerName: "", phone: "", commune: "", address: null, customerNote: null, extra: [], ip: null, userAgent: null, tracking: null, phoneBlocked: false };
  return detail;
}

// The products to pick from in the order dialogs (name, price, photo, variants)
export async function orderProducts(shopId: string) {
  const [products, variants] = await Promise.all([
    db
      .select({ id: schema.products.id, name: schema.products.name, price: schema.products.price, image: sql<string | null>`json_unquote(json_extract(${schema.products.images}, '$[0]'))` })
      .from(schema.products)
      .where(eq(schema.products.shopId, shopId))
      .orderBy(schema.products.name),
    db.select({ id: schema.productVariants.id, productId: schema.productVariants.productId, title: schema.productVariants.title, price: schema.productVariants.price }).from(schema.productVariants).where(eq(schema.productVariants.shopId, shopId)),
  ]);
  return products.map((p) => ({ ...p, variants: variants.filter((v) => v.productId === p.id).map((v) => ({ id: v.id, title: v.title, price: v.price ?? p.price })) }));
}
export type OrderProduct = Awaited<ReturnType<typeof orderProducts>>[number];
