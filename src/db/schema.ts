import {
  mysqlTable,
  varchar,
  int,
  text,
  boolean,
  timestamp,
  json,
  mysqlEnum,
  uniqueIndex,
  index,
  primaryKey,
  date,
} from "drizzle-orm/mysql-core";

const id = (name = "id") => varchar(name, { length: 36 });
const createdAt = () => timestamp("created_at").notNull().defaultNow();

// Limits a plan or a contract can set. `null` means "inherit", -1 means unlimited.
export type Limits = {
  maxProducts?: number | null;
  maxOrdersPerMonth?: number | null;
  maxStaff?: number | null;
  maxLandingPages?: number | null;
};

// ─── Accounts ─────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: id().primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  locale: varchar("locale", { length: 5 }).notNull().default("ar"),
  createdAt: createdAt(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    // sha256 of the cookie token, so a DB leak does not leak live sessions
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: id("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Platform billing: plans & per-shop contracts ─────────

export const plans = mysqlTable("plans", {
  id: id().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  priceMonthly: int("price_monthly").notNull().default(0), // in DZD
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
    theme: varchar("theme", { length: 40 }).notNull().default("classic"),
    primaryColor: varchar("primary_color", { length: 9 }).notNull().default("#4f46e5"),
    customDomain: varchar("custom_domain", { length: 191 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("shops_slug_uq").on(t.slug),
    uniqueIndex("shops_domain_uq").on(t.customDomain),
  ],
);

// A shop may have a negotiated contract that overrides its plan's ceilings
// ("Custom ceilings per shop", "Different contract per shop", start/end dates).
export const shopContracts = mysqlTable(
  "shop_contracts",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    limits: json("limits").$type<Limits>().notNull(),
    priceMonthly: int("price_monthly"),
    // Percent of a limit at which the platform admin is warned (usage thresholds)
    alertThreshold: int("alert_threshold").notNull().default(80),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("contracts_shop_idx").on(t.shopId)],
);

export const shopMembers = mysqlTable(
  "shop_members",
  {
    shopId: id("shop_id").notNull(),
    userId: id("user_id").notNull(),
    role: mysqlEnum("role", ["owner", "admin", "confirmer"]).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.userId] }), index("members_user_idx").on(t.userId)],
);

// ─── Catalog ──────────────────────────────────────────────

export type ProductOption = { name: string; values: string[] };

export const products = mysqlTable(
  "products",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    price: int("price").notNull(), // in shop currency, whole units (DZD)
    compareAtPrice: int("compare_at_price"),
    sku: varchar("sku", { length: 80 }),
    stock: int("stock").notNull().default(0),
    trackStock: boolean("track_stock").notNull().default(true),
    images: json("images").$type<string[]>().notNull(),
    options: json("options").$type<ProductOption[]>().notNull(),
    status: mysqlEnum("status", ["active", "draft"]).notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("products_shop_slug_uq").on(t.shopId, t.slug)],
);

export const productVariants = mysqlTable(
  "product_variants",
  {
    id: id().primaryKey(),
    productId: id("product_id").notNull(),
    shopId: id("shop_id").notNull(),
    // e.g. { "Size": "L", "Color": "Black" }
    optionValues: json("option_values").$type<Record<string, string>>().notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    sku: varchar("sku", { length: 80 }),
    price: int("price"), // null → product price
    stock: int("stock").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

// ─── Orders (cash on delivery) ────────────────────────────

export const orderStatuses = [
  "new",
  "confirmed",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const orders = mysqlTable(
  "orders",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    number: int("number").notNull(), // sequential per shop
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    wilayaCode: int("wilaya_code").notNull(),
    commune: varchar("commune", { length: 120 }).notNull(),
    address: varchar("address", { length: 255 }),
    deliveryType: mysqlEnum("delivery_type", ["home", "desk"]).notNull(),
    subtotal: int("subtotal").notNull(),
    shippingCost: int("shipping_cost").notNull(),
    total: int("total").notNull(),
    status: mysqlEnum("status", orderStatuses).notNull().default("new"),
    note: text("note"),
    ip: varchar("ip", { length: 45 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("orders_shop_number_uq").on(t.shopId, t.number),
    index("orders_shop_created_idx").on(t.shopId, t.createdAt),
    index("orders_phone_idx").on(t.shopId, t.phone),
  ],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: id().primaryKey(),
    orderId: id("order_id").notNull(),
    productId: id("product_id"),
    variantId: id("variant_id"),
    name: varchar("name", { length: 200 }).notNull(),
    variantTitle: varchar("variant_title", { length: 200 }),
    sku: varchar("sku", { length: 80 }),
    unitPrice: int("unit_price").notNull(),
    quantity: int("quantity").notNull(),
  },
  (t) => [index("items_order_idx").on(t.orderId)],
);

// Per-wilaya delivery prices set by each shop
export const shippingRates = mysqlTable(
  "shipping_rates",
  {
    shopId: id("shop_id").notNull(),
    wilayaCode: int("wilaya_code").notNull(),
    homePrice: int("home_price"), // null → home delivery unavailable
    deskPrice: int("desk_price"), // null → stop-desk unavailable
  },
  (t) => [primaryKey({ columns: [t.shopId, t.wilayaCode] })],
);
