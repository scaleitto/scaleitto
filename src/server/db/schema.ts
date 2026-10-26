import { mysqlTable, varchar, int, text, boolean, timestamp, json, mysqlEnum, uniqueIndex, index, primaryKey, date } from "drizzle-orm/mysql-core";

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
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("shops_slug_uq").on(t.slug)],
);

export const memberRoles = ["owner", "manager", "agent"] as const;
export type MemberRole = (typeof memberRoles)[number];

export const shopMembers = mysqlTable(
  "shop_members",
  {
    shopId: id("shop_id").notNull(),
    userId: id("user_id").notNull(),
    role: mysqlEnum("role", memberRoles).notNull(),
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
