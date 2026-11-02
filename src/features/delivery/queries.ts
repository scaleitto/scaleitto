import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";

export async function listRates(shopId: string) {
  const rows = await db.select().from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shopId)).orderBy(asc(schema.shippingRates.wilayaCode));
  return Object.fromEntries(rows.map((r) => [r.wilayaCode, { home: r.homePrice, office: r.officePrice }])) as Record<number, { home: number | null; office: number | null }>;
}

// Connected delivery accounts, without their secrets.
export async function listCarrierAccounts(shopId: string) {
  return db
    .select({ id: schema.carrierAccounts.id, carrier: schema.carrierAccounts.carrier, platform: schema.carrierAccounts.platform, baseUrl: schema.carrierAccounts.baseUrl, originWilaya: schema.carrierAccounts.originWilaya, isDefault: schema.carrierAccounts.isDefault, options: schema.carrierAccounts.options })
    .from(schema.carrierAccounts)
    .where(eq(schema.carrierAccounts.shopId, shopId))
    .orderBy(desc(schema.carrierAccounts.isDefault), asc(schema.carrierAccounts.createdAt));
}

export type CarrierAccountRow = Awaited<ReturnType<typeof listCarrierAccounts>>[number];
