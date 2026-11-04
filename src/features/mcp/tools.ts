import "server-only";
import { and, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { canAdd } from "@/server/limits";
import { orderStatuses, type OrderStatus } from "@/server/db/schema";
import { applyOrderStatus } from "@/features/orders/transition";
import { placeOrder } from "@/features/checkout/place-order";
import { orderInputSchema } from "@/features/checkout/validators";
import { sendParcel } from "@/features/delivery/send";
import { uniqueSlug } from "@/features/products/slug";
import { slugify } from "@/lib/format";
import { wilayaTitle } from "@/lib/wilayas";
import { richTextToPlain } from "@/lib/rich-text";
import type { McpCaller } from "./tokens";
import type { McpScope } from "./scopes";

// The store's tools for AI assistants. Each tool needs one scope; every query is limited to the token's store. Locked orders
// (over the plan's monthly limit) never show customer details, like the dashboard.
type Args = Record<string, unknown>;
type Tool = { name: string; scope: McpScope; description: string; inputSchema: object; run: (c: McpCaller, a: Args) => Promise<unknown> };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const obj = (properties: Record<string, object>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });

async function orderByNumber(shopId: string, n: unknown) {
  const number = num(n);
  if (number === null) return null;
  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shopId), eq(schema.orders.number, Math.trunc(number))));
  return order ?? null;
}

const orderView = (o: typeof schema.orders.$inferSelect) => ({
  number: o.number,
  status: o.status,
  createdAt: o.createdAt.toISOString(),
  total: o.total,
  shipping: o.shippingPrice,
  ...(o.locked
    ? { locked: true }
    : { customer: o.customerName, phone: o.phone, wilaya: o.wilayaCode ? `${o.wilayaCode} ${wilayaTitle(o.wilayaCode, "fr")}` : null, commune: o.commune, address: o.address, deliveryType: o.deliveryType }),
});

export const tools: Tool[] = [
  {
    name: "list_orders",
    scope: "read_orders",
    description: "List the store's latest orders (newest first). Optional status filter and search by order number, phone or name.",
    inputSchema: obj({ status: { type: "string", enum: orderStatuses }, search: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 } }),
    run: async (c, a) => {
      const o = schema.orders;
      const status = (orderStatuses as readonly string[]).includes(str(a.status)) ? (str(a.status) as OrderStatus) : null;
      const q = str(a.search, 60);
      const rows = await db
        .select()
        .from(o)
        .where(and(eq(o.shopId, c.shopId), status ? eq(o.status, status) : undefined, q ? or(eq(o.number, Number(q) || -1), and(eq(o.locked, false), or(like(o.phone, `%${q}%`), like(o.customerName, `%${q}%`)))) : undefined))
        .orderBy(desc(o.createdAt))
        .limit(Math.min(100, Math.max(1, Math.trunc(num(a.limit) ?? 20))));
      return { orders: rows.map(orderView) };
    },
  },
  {
    name: "get_order",
    scope: "read_orders",
    description: "One order by its number, with its lines.",
    inputSchema: obj({ number: { type: "integer" } }, ["number"]),
    run: async (c, a) => {
      const order = await orderByNumber(c.shopId, a.number);
      if (!order) return { error: "order_not_found" };
      const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
      return { order: { ...orderView(order), note: order.locked ? undefined : order.customerNote, lines: items.map((i) => ({ name: i.name, variant: i.variantTitle, quantity: i.quantity, unitPrice: i.unitPrice })) } };
    },
  },
  {
    name: "list_products",
    scope: "read_products",
    description: "List the store's products (optionally search by name).",
    inputSchema: obj({ search: { type: "string" } }),
    run: async (c, a) => {
      const p = schema.products;
      const q = str(a.search, 60);
      const rows = await db
        .select({ slug: p.slug, name: p.name, price: p.price, compareAtPrice: p.compareAtPrice, status: p.status, trackStock: p.trackStock, stock: p.stock })
        .from(p)
        .where(and(eq(p.shopId, c.shopId), q ? like(p.name, `%${q}%`) : undefined))
        .orderBy(desc(p.createdAt))
        .limit(100);
      return { products: rows.map((r) => ({ ...r, stock: r.trackStock ? r.stock : null })) };
    },
  },
  {
    name: "get_product",
    scope: "read_products",
    description: "One product by its slug, with its description and options.",
    inputSchema: obj({ slug: { type: "string" } }, ["slug"]),
    run: async (c, a) => {
      const [p] = await db.select().from(schema.products).where(and(eq(schema.products.shopId, c.shopId), eq(schema.products.slug, str(a.slug, 120))));
      if (!p) return { error: "product_not_found" };
      return { product: { slug: p.slug, name: p.name, price: p.price, compareAtPrice: p.compareAtPrice, status: p.status, stock: p.trackStock ? p.stock : null, description: richTextToPlain(p.description ?? ""), options: p.options.map((o) => ({ name: o.name, values: o.values })) } };
    },
  },
  {
    name: "sales_summary",
    scope: "read_analytics",
    description: "Orders and sales over a period: today, 7d or 30d (counts per status, sales of delivered orders).",
    inputSchema: obj({ period: { type: "string", enum: ["today", "7d", "30d"] } }),
    run: async (c, a) => {
      const days = str(a.period) === "today" ? 0 : str(a.period) === "30d" ? 30 : 7;
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - days);
      const o = schema.orders;
      const rows = await db
        .select({ status: o.status, n: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${o.total}), 0)` })
        .from(o)
        .where(and(eq(o.shopId, c.shopId), gte(o.createdAt, since), sql`${o.status} <> 'abandoned'`))
        .groupBy(o.status);
      const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
      const delivered = rows.find((r) => r.status === "delivered");
      return { since: since.toISOString(), orders: rows.reduce((n, r) => n + Number(r.n), 0), byStatus: by, deliveredSales: Number(delivered?.total ?? 0), currency: "DZD" };
    },
  },
  {
    name: "delivery_status",
    scope: "read_delivery",
    description: "The parcel of an order: delivery company, tracking number and stage.",
    inputSchema: obj({ number: { type: "integer" } }, ["number"]),
    run: async (c, a) => {
      const order = await orderByNumber(c.shopId, a.number);
      if (!order) return { error: "order_not_found" };
      const [s] = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, order.id));
      return s ? { carrier: s.carrierName, trackingNumber: s.trackingNumber, stage: s.status, carrierStatus: s.rawStatus } : { shipment: null, orderStatus: order.status };
    },
  },
  {
    name: "update_order_status",
    scope: "write_orders",
    description: "Change an order's status (stock, history and apps follow, as in the dashboard).",
    inputSchema: obj({ number: { type: "integer" }, status: { type: "string", enum: orderStatuses.filter((s) => s !== "abandoned") }, note: { type: "string" } }, ["number", "status"]),
    run: async (c, a) => {
      const order = await orderByNumber(c.shopId, a.number);
      if (!order) return { error: "order_not_found" };
      if (order.locked) return { error: "order_locked" };
      const status = str(a.status) as OrderStatus;
      if (!(orderStatuses as readonly string[]).includes(status) || status === "abandoned") return { error: "invalid_status" };
      await db.transaction((tx) => applyOrderStatus(tx, c.shopId, order.id, status, c.userId, str(a.note, 300) || "MCP"));
      return { ok: true, number: order.number, status };
    },
  },
  {
    name: "create_order",
    scope: "write_orders",
    description: "Create a cash-on-delivery order for one product (taken by phone, for example).",
    inputSchema: obj(
      { productSlug: { type: "string" }, quantity: { type: "integer", minimum: 1 }, name: { type: "string" }, phone: { type: "string" }, wilaya: { type: "integer", minimum: 1, maximum: 69 }, commune: { type: "string" }, address: { type: "string" }, deliveryType: { type: "string", enum: ["home", "office"] }, note: { type: "string" } },
      ["productSlug", "phone", "wilaya", "deliveryType"],
    ),
    run: async (c, a) => {
      const [p] = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.shopId, c.shopId), eq(schema.products.slug, str(a.productSlug, 120))));
      if (!p) return { error: "product_not_found" };
      const parsed = orderInputSchema.safeParse({ name: str(a.name, 120), phone: str(a.phone, 30), wilaya: String(num(a.wilaya) ?? ""), commune: str(a.commune, 120), address: str(a.address, 255), deliveryType: str(a.deliveryType), quantity: String(num(a.quantity) ?? 1), note: str(a.note, 500) });
      if (!parsed.success) return { error: "invalid_fields", fields: parsed.error.issues.map((i) => i.path.join(".")) };
      const placed = await placeOrder({ id: c.shopId }, p.id, parsed.data, { ip: null, userAgent: "MCP", memberId: c.userId, extra: [{ label: "MCP", value: "AI assistant" }] });
      return placed.ok ? { ok: true, number: placed.number } : { error: placed.error };
    },
  },
  {
    name: "create_product",
    scope: "write_products",
    description: "Create a product (active, cash on delivery) with a name and a price in DZD.",
    inputSchema: obj({ name: { type: "string" }, price: { type: "integer", minimum: 0 }, compareAtPrice: { type: "integer", minimum: 0 }, stock: { type: "integer", minimum: 0 } }, ["name", "price"]),
    run: async (c, a) => {
      const name = str(a.name, 200);
      const price = num(a.price);
      if (!name || price === null || price < 0) return { error: "invalid_fields" };
      if (!(await canAdd(c.shopId, "maxProducts"))) return { error: "plan_limit" };
      const stock = num(a.stock);
      const slug = await db.transaction(async (tx) => {
        const s = await uniqueSlug(tx, c.shopId, slugify(name) || "product");
        await tx.insert(schema.products).values({ id: newId(), shopId: c.shopId, name, slug: s, price: Math.trunc(price), compareAtPrice: num(a.compareAtPrice) ? Math.trunc(num(a.compareAtPrice)!) : null, images: [], options: [], offers: [], trackStock: stock !== null, stock: stock !== null ? Math.max(0, Math.trunc(stock)) : 0 });
        return s;
      });
      return { ok: true, slug };
    },
  },
  {
    name: "update_product",
    scope: "write_products",
    description: "Change a product's price, old price, stock or status (active / draft).",
    inputSchema: obj({ slug: { type: "string" }, price: { type: "integer", minimum: 0 }, compareAtPrice: { type: "integer", minimum: 0 }, stock: { type: "integer", minimum: 0 }, status: { type: "string", enum: ["active", "draft"] } }, ["slug"]),
    run: async (c, a) => {
      const set: Partial<typeof schema.products.$inferInsert> = {};
      if (num(a.price) !== null && num(a.price)! >= 0) set.price = Math.trunc(num(a.price)!);
      if (num(a.compareAtPrice) !== null) set.compareAtPrice = num(a.compareAtPrice)! > 0 ? Math.trunc(num(a.compareAtPrice)!) : null;
      if (num(a.stock) !== null) Object.assign(set, { trackStock: true, stock: Math.max(0, Math.trunc(num(a.stock)!)) });
      if (str(a.status) === "active" || str(a.status) === "draft") set.status = str(a.status) as "active" | "draft";
      if (!Object.keys(set).length) return { error: "nothing_to_change" };
      const r = await db.update(schema.products).set(set).where(and(eq(schema.products.shopId, c.shopId), eq(schema.products.slug, str(a.slug, 120))));
      return (r[0] as { affectedRows?: number }).affectedRows ? { ok: true } : { error: "product_not_found" };
    },
  },
  {
    name: "send_to_carrier",
    scope: "assign_delivery",
    description: "Send a confirmed order to a connected delivery company (the first connected account unless one is named).",
    inputSchema: obj({ number: { type: "integer" }, carrierAccountId: { type: "string" } }, ["number"]),
    run: async (c, a) => {
      const order = await orderByNumber(c.shopId, a.number);
      if (!order) return { error: "order_not_found" };
      const accounts = await db.select({ id: schema.carrierAccounts.id, carrier: schema.carrierAccounts.carrier }).from(schema.carrierAccounts).where(eq(schema.carrierAccounts.shopId, c.shopId));
      const account = accounts.find((x) => x.id === str(a.carrierAccountId, 36)) ?? accounts.find((x) => x.id === order.carrierAccountId) ?? accounts[0];
      if (!account) return { error: "no_delivery_company_connected" };
      const r = await sendParcel(c.shopId, order.id, account.id, {}, c.userId);
      return r.ok ? { ok: true, carrier: account.carrier } : { error: r.error, detail: r.message };
    },
  },
];
