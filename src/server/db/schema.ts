import { sql } from "drizzle-orm";
import { mysqlTable, varchar, int, text, boolean, timestamp, datetime, json, mysqlEnum, uniqueIndex, index, primaryKey, date } from "drizzle-orm/mysql-core";

// Conventions: ids are UUID strings, money is integer DZD, timestamps are server time.
const id = (name = "id") => varchar(name, { length: 36 });
const createdAt = () => timestamp("created_at").notNull().defaultNow();

// ─── Accounts ─────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: id().primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  locale: varchar("locale", { length: 5 }).notNull().default("ar"),
  createdAt: createdAt(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    // sha256 of the cookie token, so a database leak does not leak live sessions
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: id("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Plans and shops ──────────────────────────────────────

// A limit of -1 means unlimited. In a contract, a missing/null limit means "use the plan's".
export const limitKeys = ["maxProducts", "maxOrdersPerMonth", "maxStaff", "maxLandingPages", "maxAiPerMonth"] as const;
export type LimitKey = (typeof limitKeys)[number];
export type Limits = Partial<Record<LimitKey, number | null>>;

export const plans = mysqlTable("plans", {
  id: id().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  priceMonthly: int("price_monthly").notNull().default(0),
  limits: json("limits").$type<Limits>().notNull(),
  features: json("features").$type<string[]>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const shops = mysqlTable(
  "shops",
  {
    id: id().primaryKey(),
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    ownerId: id("owner_id").notNull(),
    planId: id("plan_id").notNull(),
    status: mysqlEnum("status", ["active", "suspended"]).notNull().default("active"),
    defaultLocale: varchar("default_locale", { length: 5 }).notNull().default("ar"),
    currency: varchar("currency", { length: 3 }).notNull().default("DZD"),
    phone: varchar("phone", { length: 30 }),
    logoUrl: varchar("logo_url", { length: 500 }),
    primaryColor: varchar("primary_color", { length: 9 }).notNull().default("#10b981"),
    // Storefront look (src/features/design/types.ts → StoreDesign); null → defaults
    design: json("design"),
    // How new orders reach the call center: manual, to the least busy agent, or to the least busy agent on shift
    assignMode: mysqlEnum("assign_mode", ["manual", "balanced", "on_shift"]).notNull().default("balanced"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shops_slug_uq").on(t.slug)],
);

export const memberRoles = ["owner", "manager", "agent"] as const;
export type MemberRole = (typeof memberRoles)[number];

// Work schedule of a team member, in Algeria time: weekdays (0 = Sunday … 6 = Saturday) and hours "HH:MM".
export type WorkSchedule = { days: number[]; start: string; end: string };

export const shopMembers = mysqlTable(
  "shop_members",
  {
    shopId: id("shop_id").notNull(),
    userId: id("user_id").notNull(),
    role: mysqlEnum("role", memberRoles).notNull(),
    // A deactivated member cannot sign in to the shop and gets no orders
    active: boolean("active").notNull().default(true),
    schedule: json("schedule").$type<WorkSchedule | null>(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.userId] }), index("members_user_idx").on(t.userId)],
);

// Negotiated terms for one shop: custom ceilings and dates that override its plan.
export const shopContracts = mysqlTable(
  "shop_contracts",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    limits: json("limits").$type<Limits>().notNull(),
    priceMonthly: int("price_monthly"),
    alertThreshold: int("alert_threshold").notNull().default(80),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("contracts_shop_idx").on(t.shopId)],
);

// ─── Catalog ──────────────────────────────────────────────

// e.g. { name: "Size", values: ["S", "M", "L"] }
export type ProductOption = { name: string; values: string[] };
// "2 pieces for 4500 DZD": the total price for that quantity
export type QuantityOffer = { quantity: number; price: number; label?: string };

export const productStatuses = ["active", "draft"] as const;

export const products = mysqlTable(
  "products",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    price: int("price").notNull(),
    compareAtPrice: int("compare_at_price"),
    // What the merchant pays for one piece, for profit in analytics
    costPrice: int("cost_price"),
    sku: varchar("sku", { length: 80 }),
    trackStock: boolean("track_stock").notNull().default(false),
    // Used only when the product has no variants (each variant has its own stock)
    stock: int("stock").notNull().default(0),
    // Paths like /uploads/<shop>/<file>; the first one is the main image
    images: json("images").$type<string[]>().notNull(),
    options: json("options").$type<ProductOption[]>().notNull(),
    offers: json("offers").$type<QuantityOffer[]>().notNull(),
    status: mysqlEnum("status", productStatuses).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("products_shop_slug_uq").on(t.shopId, t.slug), index("products_shop_created_idx").on(t.shopId, t.createdAt)],
);

// One row per combination of option values, e.g. { Size: "L", Color: "Black" }
export const productVariants = mysqlTable(
  "product_variants",
  {
    id: id().primaryKey(),
    productId: id("product_id").notNull(),
    shopId: id("shop_id").notNull(),
    optionValues: json("option_values").$type<Record<string, string>>().notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    sku: varchar("sku", { length: 80 }),
    // null → the product's price
    price: int("price"),
    stock: int("stock").notNull().default(0),
    position: int("position").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

// ─── Orders (cash on delivery) ────────────────────────────

// no_answer: the customer did not pick up; postponed: asked to be called later
export const orderStatuses = ["new", "no_answer", "postponed", "confirmed", "shipped", "delivered", "returned", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const deliveryTypes = ["home", "office"] as const;
export type DeliveryType = (typeof deliveryTypes)[number];

export const orders = mysqlTable(
  "orders",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    // Sequential per shop, shown to merchants and customers (#1001, #1002…)
    number: int("number").notNull(),
    status: mysqlEnum("status", orderStatuses).notNull().default("new"),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    wilayaCode: int("wilaya_code").notNull(),
    commune: varchar("commune", { length: 120 }).notNull(),
    address: varchar("address", { length: 255 }),
    deliveryType: mysqlEnum("delivery_type", deliveryTypes).notNull(),
    subtotal: int("subtotal").notNull(),
    shippingPrice: int("shipping_price").notNull(),
    total: int("total").notNull(),
    customerNote: varchar("customer_note", { length: 500 }),
    // Call center agent in charge of confirming the order
    assignedTo: id("assigned_to"),
    assignedAt: timestamp("assigned_at"),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("orders_shop_number_uq").on(t.shopId, t.number),
    index("orders_shop_created_idx").on(t.shopId, t.createdAt),
    index("orders_shop_status_idx").on(t.shopId, t.status),
    index("orders_shop_phone_idx").on(t.shopId, t.phone),
    index("orders_shop_assigned_idx").on(t.shopId, t.assignedTo, t.status),
  ],
);

// A snapshot of what was ordered: later product edits never change past orders.
export const orderItems = mysqlTable(
  "order_items",
  {
    id: id().primaryKey(),
    orderId: id("order_id").notNull(),
    shopId: id("shop_id").notNull(),
    productId: id("product_id"),
    variantId: id("variant_id"),
    name: varchar("name", { length: 200 }).notNull(),
    variantTitle: varchar("variant_title", { length: 200 }),
    sku: varchar("sku", { length: 80 }),
    unitPrice: int("unit_price").notNull(),
    quantity: int("quantity").notNull(),
    total: int("total").notNull(),
    offerLabel: varchar("offer_label", { length: 60 }),
    // True when stock was taken for this line (given back if the order is cancelled or returned)
    stockTracked: boolean("stock_tracked").notNull().default(false),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// Order history: creation, status changes, notes and edits, with who did it.
export const orderEvents = mysqlTable(
  "order_events",
  {
    id: id().primaryKey(),
    orderId: id("order_id").notNull(),
    shopId: id("shop_id").notNull(),
    userId: id("user_id"),
    type: mysqlEnum("type", ["created", "status", "note", "edit", "assign"]).notNull(),
    fromStatus: varchar("from_status", { length: 20 }),
    toStatus: varchar("to_status", { length: 20 }),
    note: text("note"),
    // Milliseconds, so events of the same second stay in order
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

// Visitors who typed a valid phone in the order form but did not order (abandoned carts).
export const leadStatuses = ["abandoned", "contacted", "converted"] as const;
export const leads = mysqlTable(
  "leads",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    productId: id("product_id").notNull(),
    variantId: id("variant_id"),
    quantity: int("quantity").notNull().default(1),
    name: varchar("name", { length: 120 }),
    phone: varchar("phone", { length: 20 }).notNull(),
    wilayaCode: int("wilaya_code"),
    status: mysqlEnum("status", leadStatuses).notNull().default("abandoned"),
    orderId: id("order_id"),
    ip: varchar("ip", { length: 45 }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("leads_shop_status_idx").on(t.shopId, t.status, t.createdAt), index("leads_shop_phone_idx").on(t.shopId, t.phone)],
);

// Delivery price per wilaya (edited in the Delivery section). null → that delivery type is unavailable.
export const shippingRates = mysqlTable(
  "shipping_rates",
  {
    shopId: id("shop_id").notNull(),
    wilayaCode: int("wilaya_code").notNull(),
    homePrice: int("home_price"),
    officePrice: int("office_price"),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.wilayaCode] })],
);

// A delivery company account connected by the shop. Credentials are encrypted (src/server/crypto.ts).
export const carrierPlatforms = ["yalidine", "ecotrack", "procolis", "noest"] as const;
export type CarrierPlatform = (typeof carrierPlatforms)[number];

export const carrierAccounts = mysqlTable(
  "carrier_accounts",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    // Key from the catalog in src/features/delivery/carriers.ts (e.g. "yalidine", "dhd")
    carrier: varchar("carrier", { length: 40 }).notNull(),
    platform: mysqlEnum("platform", carrierPlatforms).notNull(),
    baseUrl: varchar("base_url", { length: 255 }).notNull(),
    credentials: text("credentials").notNull(),
    // Wilaya the parcels leave from (required by Yalidine)
    originWilaya: int("origin_wilaya").notNull().default(16),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("carrier_accounts_shop_carrier_uq").on(t.shopId, t.carrier)],
);

// normalized parcel statuses, whatever the carrier's wording
export const shipmentStatuses = ["created", "in_transit", "out_for_delivery", "attempted", "delivered", "returning", "returned", "cancelled", "unknown"] as const;
export type ShipmentStatus = (typeof shipmentStatuses)[number];

// The parcel of an order at a delivery company (or entered by hand).
export const shipments = mysqlTable(
  "shipments",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    orderId: id("order_id").notNull(),
    // null when the tracking number was typed by hand
    carrierAccountId: id("carrier_account_id"),
    carrierName: varchar("carrier_name", { length: 80 }).notNull(),
    trackingNumber: varchar("tracking_number", { length: 80 }).notNull(),
    labelUrl: varchar("label_url", { length: 500 }),
    status: mysqlEnum("status", shipmentStatuses).notNull().default("created"),
    rawStatus: varchar("raw_status", { length: 120 }),
    checkedAt: timestamp("checked_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shipments_order_uq").on(t.orderId), index("shipments_shop_status_idx").on(t.shopId, t.status)],
);

// Phone numbers a shop refuses orders from (fake orders, repeated refusals…).
export const blockedPhones = mysqlTable(
  "blocked_phones",
  {
    shopId: id("shop_id").notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    reason: varchar("reason", { length: 200 }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.phone] })],
);

// Time each member spends working in the dashboard, per Algeria day (filled by a heartbeat
// every minute while the dashboard is open and used).
export const memberActivity = mysqlTable(
  "member_activity",
  {
    shopId: id("shop_id").notNull(),
    userId: id("user_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    // datetime, not timestamp: older MySQL/MariaDB auto-update the first timestamp column of a table
    firstSeen: datetime("first_seen").notNull(),
    lastSeen: datetime("last_seen").notNull(),
    activeMinutes: int("active_minutes").notNull().default(0),
    // Minutes counted inside the member's scheduled hours
    shiftMinutes: int("shift_minutes").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.userId, t.day] })],
);

// ─── Operations ───────────────────────────────────────────

// Server errors, readable by the platform admin (shared hosting has no easy log access).
export const errorLogs = mysqlTable(
  "error_logs",
  {
    id: id().primaryKey(),
    digest: varchar("digest", { length: 64 }),
    message: text("message").notNull(),
    stack: text("stack"),
    path: varchar("path", { length: 500 }),
    method: varchar("method", { length: 10 }),
    routeType: varchar("route_type", { length: 20 }),
    createdAt: createdAt(),
  },
  (t) => [index("errors_created_idx").on(t.createdAt)],
);
