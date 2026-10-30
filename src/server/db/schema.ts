import { sql } from "drizzle-orm";
import { mysqlTable, varchar, int, text, boolean, timestamp, datetime, json, mysqlEnum, uniqueIndex, index, primaryKey, date } from "drizzle-orm/mysql-core";

// Conventions: ids are UUID strings, money is integer DZD, timestamps are server time.
// Value lists shared with browser code live in a plain module (no database code in client bundles)
import { expenseCategories, limitKeys, paymentMethods, pixelPlatforms, policyKinds, purchaseTriggers, type LimitKey, type ParcelDefaults, type PolicyKind, type ProtectionSettings } from "../../lib/enums";
export { expenseCategories, limitKeys, paymentMethods, pixelPlatforms, policyKinds, purchaseTriggers };
export type { ExpenseCategory, LimitKey, PaymentMethod, PixelPlatform, PolicyKind, PurchaseTrigger } from "../../lib/enums";

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
  // When the owner clicked the link sent to their email (null: not confirmed yet)
  emailVerifiedAt: datetime("email_verified_at"),
  createdAt: createdAt(),
});

// One-time links sent by email: confirm the address, or choose a new password. Only the sha256 of the token is stored.
export const authTokenKinds = ["verify", "reset"] as const;
export const authTokens = mysqlTable(
  "auth_tokens",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: id("user_id").notNull(),
    kind: mysqlEnum("kind", authTokenKinds).notNull(),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.kind)],
);

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
export type Limits = Partial<Record<LimitKey, number | null>>;

export const plans = mysqlTable("plans", {
  id: id().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  priceMonthly: int("price_monthly").notNull().default(0),
  // Pay as you go: orders bought with one purchase (price_monthly is then the price of that pack, never expires).
  // null = a monthly plan.
  orderPack: int("order_pack"),
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
    // End of a paid period (null: no end). After it, the shop is back on the free plan's limits.
    planExpiresAt: datetime("plan_expires_at"),
    // Orders left on a pay-as-you-go plan (each order placed uses one; src/features/plans/locked.ts)
    orderCredits: int("order_credits").notNull().default(0),
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
    // Messages agents send to customers (WhatsApp / SMS), see src/features/messages/templates.ts
    messages: json("messages"),
    // Search engines and link previews (src/features/settings/types.ts)
    seo: json("seo").$type<ShopSeo | null>(),
    // Policy pages shown in the store footer (plain text)
    policies: json("policies").$type<ShopPolicies | null>(),
    // Fake-order protection settings (src/features/checkout/protection-settings.ts); null → defaults
    protection: json("protection").$type<Partial<ProtectionSettings> | null>(),
    // The store's order form (features/landing/types.ts FormSettings, read through resolveForm): product pages use it,
    // new landing pages start from it
    orderForm: json("order_form"),
    // Inventory: a product or variant at or under this quantity is "low" (Inventory section, overview alert)
    lowStock: int("low_stock").notNull().default(5),
    // The merchant's own prompt for AI landing pages, used by default when set (src/features/landing/strategy.ts)
    aiPrompt: text("ai_prompt"),
    // The merchant's own domain (lower case, without www). Served once its DNS is verified.
    customDomain: varchar("custom_domain", { length: 191 }),
    // Value of the TXT record _scaleitto.<domain> proving the merchant owns it
    domainToken: varchar("domain_token", { length: 64 }),
    domainVerifiedAt: datetime("domain_verified_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shops_slug_uq").on(t.slug), uniqueIndex("shops_domain_uq").on(t.customDomain)],
);

export type ShopSeo = { title?: string; description?: string };
export type ShopPolicies = Partial<Record<PolicyKind, string>>;
// The AI's marketing strategy for a landing page: who it talks to and the angles it chose (with the reason)
// key = one of the 11 angles (lib/enums.ts landingAngles); required = one of the 5 the automatic mode must use;
// mode = how they were chosen (auto by the AI, manual by the merchant)
export type PageStrategy = { audience: string; angles: { name: string; why: string; key?: string; required?: boolean }[]; custom: boolean; mode?: "auto" | "manual" };

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
// kind "color": the values are shown as color swatches (colors = value → #rrggbb)
export type ProductOption = { name: string; values: string[]; kind?: "color"; colors?: Record<string, string> };
// "2 pieces for 4500 DZD": the total price for that quantity
// A quantity offer: `quantity` pieces for `price` in all, with optional extras shown on the offer card and honoured
// at checkout — free delivery, a gift, a highlight badge (bestSeller / bestValue), chosen by default.
export const offerBadges = ["bestSeller", "bestValue", "limited"] as const;
export type OfferBadge = (typeof offerBadges)[number];
export type QuantityOffer = { quantity: number; price: number; label?: string; freeShipping?: boolean; gift?: string; badge?: OfferBadge; preselected?: boolean };

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
    // AI call guide for the call center (src/features/ai/call-guide.ts → CallGuide)
    callGuide: json("call_guide"),
    // Where an imported product came from ("shopify:<store>:<id>", "youcan:<id>"), so it is never imported twice
    externalRef: varchar("external_ref", { length: 191 }),
    // The order form template for this product (form_templates), null = the store's form
    formTemplateId: id("form_template_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("products_shop_slug_uq").on(t.shopId, t.slug),
    index("products_shop_created_idx").on(t.shopId, t.createdAt),
    uniqueIndex("products_shop_external_uq").on(t.shopId, t.externalRef),
  ],
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

// The order's status (the owner's model, src/features/orders/statuses.ts groups them):
// confirmation call — new, confirmed, cancelled, callback (Rappel), no_answer, voicemail, fake, wrong_number, duplicate,
// remark —, then the parcel's life — shipped, delivered, returned (the final delivery).
export const orderStatuses = ["new", "confirmed", "cancelled", "callback", "no_answer", "voicemail", "fake", "wrong_number", "duplicate", "remark", "shipped", "delivered", "returned"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
// Delivery follow-up once the parcel left (Livraison): set by the courier tracking, editable by the team
export const deliveryStates = ["shipped", "postponed", "no_answer", "delivered", "returned"] as const;
export type DeliveryState = (typeof deliveryStates)[number];
// Whose fault a failed delivery was (Remarque sur la livraison)
export const deliveryFaults = ["courier", "customer", "company"] as const;
export type DeliveryFault = (typeof deliveryFaults)[number];
// After-sale handling (Traitement): a complaint, or the parcel sent again
export const processingStates = ["claim", "reinjected"] as const;
export type ProcessingState = (typeof processingStates)[number];
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
    // Landing page the order came from (null: the store's product page)
    landingPageId: id("landing_page_id"),
    // Answers to the landing page's custom form fields: [{ label, value }]
    extra: json("extra").$type<{ label: string; value: string }[] | null>(),
    // Placed after the month's order limit was reached: kept, but the customer's details stay hidden
    // until the shop upgrades or the month is over (src/features/plans/locked.ts)
    locked: boolean("locked").notNull().default(false),
    // Ad-click identifiers captured when the order was placed (for server-side pixel events)
    tracking: json("tracking").$type<OrderTracking | null>(),
    // Call center agent in charge of confirming the order
    assignedTo: id("assigned_to"),
    assignedAt: timestamp("assigned_at"),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    // Fake-order risk computed when the order was placed (0–100, src/features/checkout/risk.ts) and why;
    // set back to 0 when someone marks the order as trusted
    risk: int("risk").notNull().default(0),
    riskReasons: json("risk_reasons").$type<string[] | null>(),
    // Finance: when the cash-on-delivery money of this delivered order was received from the courier (null: still owed)
    paidAt: datetime("paid_at"),
    // Delivery follow-up (src/features/orders/followup.ts)
    deliveryState: mysqlEnum("delivery_state", deliveryStates),
    deliveryFault: mysqlEnum("delivery_fault", deliveryFaults),
    processing: mysqlEnum("processing", processingStates),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("orders_shop_number_uq").on(t.shopId, t.number),
    // The phone's history across every store (the network signal of the fake-order protection)
    index("orders_phone_idx").on(t.phone),
    index("orders_shop_created_idx").on(t.shopId, t.createdAt),
    index("orders_shop_status_idx").on(t.shopId, t.status),
    index("orders_shop_phone_idx").on(t.shopId, t.phone),
    index("orders_shop_assigned_idx").on(t.shopId, t.assignedTo, t.status),
    index("orders_shop_locked_idx").on(t.shopId, t.locked, t.createdAt),
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
    offerLabel: varchar("offer_label", { length: 160 }),
    // True when stock was taken for this line (given back if the order is cancelled or returned)
    stockTracked: boolean("stock_tracked").notNull().default(false),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// ─── Landing pages ────────────────────────────────────────

// Sections and form settings are typed in src/features/landing/types.ts and always sanitized before saving.
export const landingPages = mysqlTable(
  "landing_pages",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    productId: id("product_id").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
    // Language of the page's copy: ar, dz (Darija), fr, en
    language: varchar("language", { length: 5 }).notNull().default("ar"),
    // null → the shop's color
    color: varchar("color", { length: 9 }),
    sections: json("sections").notNull(),
    form: json("form").notNull(),
    // What the AI chose for this page (audience, marketing angles and why), shown in the editor
    strategy: json("strategy").$type<PageStrategy | null>(),
    views: int("views").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("landing_shop_slug_uq").on(t.shopId, t.slug)],
);

// AI landing page generations: one row per request sent to OpenAI (also counts the monthly AI limit).
export const aiGenerations = mysqlTable(
  "ai_generations",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    userId: id("user_id").notNull(),
    // landing (a landing page) or a small task: call_guide, messages, description, image (src/features/ai/tasks.ts)
    kind: varchar("kind", { length: 30 }).notNull().default("landing"),
    // OpenAI background response id
    responseId: varchar("response_id", { length: 120 }),
    model: varchar("model", { length: 80 }),
    status: mysqlEnum("status", ["pending", "saving", "done", "failed"]).notNull().default("pending"),
    // What to build when the text is ready (product to use or create, language, color…)
    brief: json("brief").notNull(),
    landingPageId: id("landing_page_id"),
    // What a finished task produced (returned to the browser)
    result: json("result"),
    error: text("error"),
    inputTokens: int("input_tokens"),
    outputTokens: int("output_tokens"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("ai_generations_shop_created_idx").on(t.shopId, t.createdAt)],
);

// Order history: creation, status changes, notes and edits, with who did it.
export const orderEvents = mysqlTable(
  "order_events",
  {
    id: id().primaryKey(),
    orderId: id("order_id").notNull(),
    shopId: id("shop_id").notNull(),
    userId: id("user_id"),
    type: mysqlEnum("type", ["created", "status", "note", "edit", "assign", "message", "risk", "followup"]).notNull(),
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
export const carrierPlatforms = ["yalidine", "ecotrack", "procolis", "noest", "zrexpress"] as const;
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
    // Starting options of every parcel sent with this account (src/lib/enums.ts ParcelDefaults)
    options: json("options").$type<Partial<ParcelDefaults>>(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("carrier_accounts_shop_carrier_uq").on(t.shopId, t.carrier)],
);

// normalized parcel statuses, whatever the carrier's wording
// A parcel's stage, in the order the Ecotrack couriers (Packers, DHD…) show them: ready to ship, being picked up,
// to the station, at the station, to the wilaya, being prepared, out for delivery, suspended (failed attempt, postponed),
// delivered, returns, then cancelled / deleted / to delete. Other couriers' wording is mapped to these (delivery/status.ts).
export const shipmentStatuses = ["ready", "pickup", "to_station", "at_station", "to_wilaya", "preparing", "out_for_delivery", "suspended", "delivered", "returning", "returned", "cancelled", "deleted", "to_delete", "unknown"] as const;
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
    status: mysqlEnum("status", shipmentStatuses).notNull().default("ready"),
    rawStatus: varchar("raw_status", { length: 120 }),
    checkedAt: timestamp("checked_at"),
    // Returns: when the returned parcel was received back by the merchant
    returnReceivedAt: datetime("return_received_at"),
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

// ─── Pixels ───────────────────────────────────────────────

export type OrderTracking = { url?: string; fbp?: string; fbc?: string; ttp?: string; ttclid?: string; gaClientId?: string };

// One ad platform tag of a shop. Several per platform are allowed (e.g. one Meta pixel per product).
export const pixels = mysqlTable(
  "pixels",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    platform: mysqlEnum("platform", pixelPlatforms).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    // Pixel ID / Measurement ID / container ID (validated per platform: it ends up in an inline script)
    tagId: varchar("tag_id", { length: 40 }).notNull(),
    // Encrypted server-side secret: Conversions API token, Events API token or GA4 API secret
    secret: text("secret"),
    // Meta / TikTok test event code: server events then show in the platform's "Test events" tab
    testCode: varchar("test_code", { length: 40 }),
    purchaseOn: mysqlEnum("purchase_on", purchaseTriggers).notNull().default("placed"),
    // null: every page and order; otherwise only these products (their pages, landing pages and orders)
    productIds: json("product_ids").$type<string[] | null>(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("pixels_shop_idx").on(t.shopId)],
);

// Server-side events sent for orders: one row per pixel, order and event (never sent twice), kept as a log.
export const pixelEvents = mysqlTable(
  "pixel_events",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    pixelId: id("pixel_id").notNull(),
    orderId: id("order_id"),
    event: varchar("event", { length: 40 }).notNull(),
    status: mysqlEnum("status", ["sending", "sent", "failed"]).notNull(),
    detail: varchar("detail", { length: 500 }),
    createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("pixel_events_once_uq").on(t.pixelId, t.orderId, t.event), index("pixel_events_shop_idx").on(t.shopId, t.createdAt)],
);

// ─── Apps ─────────────────────────────────────────────────

// Apps that receive every order and its changes
// WhatsApp Business API (Meta Cloud API) for customer messages sent straight from the order page.
// One per shop; the access token is encrypted. A situation with a template uses it (Meta requires approved
// templates for messages the store starts); others are sent as text (delivered only inside the 24-hour window).
export type WhatsAppTemplate = { name: string; language: string; params: string[] };
export const shopWhatsapp = mysqlTable("shop_whatsapp", {
  shopId: id("shop_id").primaryKey(),
  phoneNumberId: varchar("phone_number_id", { length: 40 }).notNull(),
  token: text("token").notNull(),
  templates: json("templates").$type<Partial<Record<string, WhatsAppTemplate>>>().notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const appKeys = ["google_sheets", "webhook"] as const;
export type AppKey = (typeof appKeys)[number];

// One connected app per shop and kind. The URL is the merchant's Apps Script / webhook endpoint;
// the secret (token or signing key) is encrypted.
export const shopApps = mysqlTable(
  "shop_apps",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    app: mysqlEnum("app", appKeys).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    secret: text("secret").notNull(),
    active: boolean("active").notNull().default(true),
    // The spreadsheet's own link, as the script reports it ("Open the sheet" button)
    sheetUrl: varchar("sheet_url", { length: 500 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shop_apps_shop_app_uq").on(t.shopId, t.app)],
);

// What was sent to the apps (last ones shown on the dashboard)
export const appEvents = mysqlTable(
  "app_events",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    app: mysqlEnum("app", appKeys).notNull(),
    orderId: id("order_id"),
    // "order" (one order), "backfill" (many), "test"
    kind: varchar("kind", { length: 20 }).notNull(),
    ok: boolean("ok").notNull(),
    detail: varchar("detail", { length: 500 }),
    createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("app_events_shop_idx").on(t.shopId, t.createdAt)],
);

// Orders waiting to be sent to the shop's apps (one row per order). Sending is retried with growing delays,
// so an app that is down, slow or a send that never ran (server restarted, hosting cut it) still arrives.
export const appQueue = mysqlTable(
  "app_queue",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    orderId: id("order_id").notNull(),
    event: varchar("event", { length: 20 }).notNull(),
    attempts: int("attempts").notNull().default(0),
    nextAt: datetime("next_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    lastError: varchar("last_error", { length: 500 }),
    createdAt: datetime("created_at", { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [uniqueIndex("app_queue_order_uq").on(t.shopId, t.orderId), index("app_queue_due_idx").on(t.nextAt)],
);

// ─── Plan upgrades ────────────────────────────────────────

export const planRequestStatuses = ["pending", "approved", "rejected", "cancelled"] as const;

// A merchant's request to move to a plan, paid by transfer (receipt image) and approved by the platform admin.
export const planRequests = mysqlTable(
  "plan_requests",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    planId: id("plan_id").notNull(),
    // Months of a monthly plan, or packs of a pay-as-you-go plan
    months: int("months").notNull(),
    amount: int("amount").notNull(),
    method: mysqlEnum("method", paymentMethods).notNull(),
    // /uploads/<shop>/<file> (transfer receipt), null for WhatsApp
    receiptUrl: varchar("receipt_url", { length: 255 }),
    note: varchar("note", { length: 500 }),
    status: mysqlEnum("status", planRequestStatuses).notNull().default("pending"),
    adminNote: varchar("admin_note", { length: 500 }),
    requestedBy: id("requested_by").notNull(),
    decidedAt: datetime("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [index("plan_requests_shop_idx").on(t.shopId, t.createdAt), index("plan_requests_status_idx").on(t.status, t.createdAt)],
);

// ─── Inventory, finance, form templates (round 7) ─────────

// Every change of a product's (or variant's) stock and why: orders take it, cancellations/returns give it back,
// the merchant restocks, corrects or writes off. delta < 0 = out.
export const stockReasons = ["order", "cancel", "return", "reopen", "restock", "adjust", "damaged", "edit"] as const;
export type StockReason = (typeof stockReasons)[number];
export const stockMovements = mysqlTable(
  "stock_movements",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    productId: id("product_id").notNull(),
    variantId: id("variant_id"),
    delta: int("delta").notNull(),
    reason: mysqlEnum("reason", stockReasons).notNull(),
    note: varchar("note", { length: 200 }),
    orderId: id("order_id"),
    userId: id("user_id"),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_shop_idx").on(t.shopId, t.createdAt), index("stock_movements_product_idx").on(t.productId, t.createdAt)],
);

// Money the shop spends (entered by the merchant), for the net profit in Finance
export const expenses = mysqlTable(
  "expenses",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    category: mysqlEnum("category", expenseCategories).notNull(),
    amount: int("amount").notNull(),
    note: varchar("note", { length: 200 }),
    createdBy: id("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_shop_day_idx").on(t.shopId, t.day)],
);

// Order form templates: a product with formTemplateId uses its template instead of the store's form
export const formTemplates = mysqlTable(
  "form_templates",
  {
    id: id().primaryKey(),
    shopId: id("shop_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    form: json("form").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("form_templates_shop_idx").on(t.shopId)],
);
