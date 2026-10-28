import { asc, eq } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { db, schema } from "@/server/db";
import { MarketingHome, type HomePlan } from "@/features/marketing/Home";

// The active plans for the pricing section; the homepage still renders (without prices) if the database is down
async function activePlans(): Promise<HomePlan[]> {
  try {
    return await db
      .select({ code: schema.plans.code, name: schema.plans.name, priceMonthly: schema.plans.priceMonthly, limits: schema.plans.limits })
      .from(schema.plans)
      .where(eq(schema.plans.isActive, true))
      .orderBy(asc(schema.plans.priceMonthly));
  } catch {
    return [];
  }
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const lang = asLocale((await params).lang);
  return <MarketingHome lang={lang} t={getDictionary(lang)} plans={await activePlans()} />;
}
