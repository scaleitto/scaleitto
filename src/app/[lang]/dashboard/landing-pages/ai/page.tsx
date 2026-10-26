import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireManager } from "@/lib/auth";
import { getEffectiveLimits, getUsage } from "@/lib/limits";
import { aiConfigured } from "@/lib/ai/openai";
import { UsageBar } from "@/components/UsageBar";
import { advanceAiJob, startAiLanding } from "../actions";
import { AiForm } from "./AiForm";

export default async function AiLandingPage({ params }: PageProps<"/[lang]/dashboard/landing-pages/ai">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);
  const [products, { limits }, usage] = await Promise.all([
    db
      .select({ id: schema.products.id, name: schema.products.name, images: schema.products.images })
      .from(schema.products)
      .where(eq(schema.products.shopId, shop.id)),
    getEffectiveLimits(shop.id),
    getUsage(shop.id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.ai.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.ai.hint}</p>
      </div>
      <div className="card">
        <UsageBar label={t.ai.usage} used={usage.maxAiPerMonth} limit={limits.maxAiPerMonth} unlimitedLabel={t.common.unlimited} />
      </div>
      {!aiConfigured() ? (
        <div className="card text-center text-slate-600">{t.ai.notConfigured}</div>
      ) : (
        <AiForm
          t={t}
          lang={lang}
          action={startAiLanding.bind(null, lang)}
          checkStatus={advanceAiJob.bind(null, lang)}
          products={products.map((p) => ({ id: p.id, name: p.name, image: p.images[0] ?? null }))}
          defaultLanguage={shop.defaultLocale}
        />
      )}
    </div>
  );
}
