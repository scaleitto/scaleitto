import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/ui";
import { BlockedPhones, ProtectionForm } from "@/features/orders/ProtectionPanel";
import { protectionOverview } from "@/features/orders/queries";
import { protectionFor } from "@/features/checkout/protection";

// Orders → Protection (owners and managers): fake orders and robots
export default async function ProtectionPage({ params }: PageProps<"/[lang]/dashboard/orders/protection">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "protection");
  const settings = await protectionFor(shop.id);
  const overview = await protectionOverview(shop.id, settings.riskThreshold);
  const p = t.orders.protection;
  const text = { orders: t.orders, errors: t.errors, common: t.common };
  return (
    <>
      <PageHeader title={t.sections.protection.title} description={t.sections.protection.description} />
      <div className="space-y-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{p.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">{p.intro}</p>
          </div>
          <dl className="flex gap-3" data-testid="protection-stats">
            {[
              [p.stats.suspicious, overview.suspicious],
              [p.stats.refused, overview.blocked.length],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl border border-line bg-panel px-4 py-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ProtectionForm lang={lang} settings={settings} t={text} />
        <BlockedPhones lang={lang} phones={overview.blocked.map((b) => ({ phone: b.phone, reason: b.reason, date: formatDate(b.createdAt, lang) }))} t={text} />
      </div>
    </>
  );
}
