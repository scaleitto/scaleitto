import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/server/db";
import type { OrderStatus } from "./statuses";
import { visibleOrders, type OrderViewer } from "./access";
import { escapeLike } from "@/lib/validation";

export const PAGE_SIZE = 25;


// assignee: a member id, or "none" for orders nobody is in charge of
export async function listOrders(viewer: OrderViewer, { q = "", status, page = 1, assignee }: { q?: string; status?: OrderStatus; page?: number; assignee?: string }) {
  const o = schema.orders;
  const filters: (SQL | undefined)[] = [visibleOrders(viewer)];
  if (status) filters.push(eq(o.status, status));
  if (assignee === "none") filters.push(isNull(o.assignedTo));
  else if (assignee) filters.push(eq(o.assignedTo, assignee));
  const term = q.trim();
  if (term) {
    const digits = term.replace(/[^\d]/g, "");
    const like_ = `%${escapeLike(term)}%`;
    filters.push(
      or(
        // A locked order's customer cannot be found by name or phone (that would reveal them)
        and(eq(o.locked, false), or(like(o.customerName, like_), digits ? like(o.phone, `%${digits.replace(/^213/, "")}%`) : undefined)),
        /^#?\d+$/.test(term) ? eq(o.number, Number(term.replace("#", ""))) : undefined,
      ),
    );
  }
  const where = and(...filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: o.id,
        number: o.number,
        status: o.status,
        customerName: o.customerName,
        phone: o.phone,
        wilayaCode: o.wilayaCode,
        total: o.total,
        createdAt: o.createdAt,
        locked: o.locked,
        assigneeName: schema.users.name,
        // First product of the order, for the list
        // (written as plain SQL: inside a select Drizzle drops table names, which made the columns ambiguous)
        product: sql<string | null>`(select concat(oi.name, ' ×', oi.quantity) from order_items oi where oi.order_id = orders.id limit 1)`,
      })
      .from(o)
      .leftJoin(schema.users, eq(schema.users.id, o.assignedTo))
      .where(where)
      .orderBy(desc(o.createdAt), desc(o.number))
      .limit(PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(o).where(where),
  ]);
  return { rows: rows.map((r) => (r.locked ? { ...r, customerName: "", phone: "" } : r)), total };
}

export async function statusCounts(viewer: OrderViewer) {
  const rows = await db.select({ status: schema.orders.status, n: count() }).from(schema.orders).where(visibleOrders(viewer)).groupBy(schema.orders.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>;
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
  const byStatus = Object.fromEntries(history.map((h) => [h.status, h.n])) as Partial<Record<OrderStatus, number>>;
  const phoneStats = {
    orders: history.reduce((sum, h) => sum + h.n, 0),
    delivered: byStatus.delivered ?? 0,
    failed: (byStatus.cancelled ?? 0) + (byStatus.returned ?? 0),
  };
  const detail = { ...order, items, events, phoneStats, phoneBlocked: blocked.n > 0, assigneeName: (assignee as { name: string } | undefined)?.name ?? null,
    landingTitle: (landing as { title: string } | undefined)?.title ?? null,
    extra: Array.isArray(order.extra) ? (order.extra as { label: string; value: string }[]) : [],
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
