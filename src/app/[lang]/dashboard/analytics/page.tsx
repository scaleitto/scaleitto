import Link from "next/link";
import { connection } from "next/server";
import { ChartNoAxesColumn, Eye, Headphones, Package, ShoppingCart } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { presets, resolveRange } from "@/features/analytics/range";
import { shopAnalytics } from "@/features/analytics/queries";
import { ImpressionsTab, OrdersTab, ProductsTab, TeamTab } from "@/features/analytics/views";
import { PeriodSelect } from "@/features/analytics/PeriodSelect";

const tabs = [
  ["orders", ShoppingCart],
  ["products", Package],
  ["impressions", Eye],
  ["team", Headphones],
] as const;
type Tab = (typeof tabs)[number][0];

// Zimam's analytics: the title, the period, four tabs (orders, products, impressions, call center)
export default async function AnalyticsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/analytics">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const a = t.analytics;
  const { shop } = await requireSection(lang, "analytics");
  await connection();
  const sp = await searchParams;
  const range = resolveRange({ period: sp.period });
  const tab: Tab = tabs.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : "orders";
  const data = await shopAnalytics(shop.id, range);
  const base = sectionHref(lang, "analytics");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ChartNoAxesColumn size={24} className="text-accent" /> {t.sections.analytics.title}
          </h1>
          <p className="mt-1 text-sm text-muted">{a.subtitle}</p>
        </div>
        <PeriodSelect base={base} tab={tab} value={range.preset} options={presets.map((p) => ({ value: p, label: a.periods[p] }))} />
      </div>
      <nav className="inline-flex flex-wrap rounded-xl border border-line bg-panel p-1" data-testid="analytics-tabs">
        {tabs.map(([key, Icon]) => (
          <Link
            key={key}
            href={`${base}?tab=${key}&period=${range.preset}`}
            aria-current={tab === key ? "page" : undefined}
            data-tab={key}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${tab === key ? "bg-accent text-white" : "text-fg-2 hover:bg-panel-2"}`}
          >
            <Icon size={16} /> {a.tabs[key]}
          </Link>
        ))}
      </nav>
      {tab === "orders" && <OrdersTab data={data} lang={lang} t={t} />}
      {tab === "products" && <ProductsTab data={data} lang={lang} t={t} productsHref={sectionHref(lang, "products")} />}
      {tab === "impressions" && (
        <ImpressionsTab data={data} lang={lang} t={t} trend={sp.trend === "visitors" ? "visitors" : "impressions"} trendHref={(k) => `${base}?tab=impressions&period=${range.preset}&trend=${k}`} />
      )}
      {tab === "team" && <TeamTab data={data} teamHref={sectionHref(lang, "callCenters")} t={t} />}
    </div>
  );
}
