import { LayoutTemplate } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { Card, EmptyState, PageHeader } from "@/ui";
import { formatDate } from "@/lib/format";
import { listLandingPages, productChoices } from "@/features/landing/queries";
import { LandingList } from "@/features/landing/LandingList";
import { AiTestCard } from "@/features/landing/AiTestCard";
import { testAi } from "@/features/landing/ai-actions";

export default async function LandingPagesPage({ params }: PageProps<"/[lang]/dashboard/landing-pages">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const lp = t.landingPages;
  const { shop, role } = await requireSection(lang, "landingPages");
  const [pages, products] = await Promise.all([listLandingPages(shop.id), productChoices(shop.id)]);
  const base = sectionHref(lang, "landingPages");
  const store = storeUrl(shop);
  const live = pages.filter((p) => p.status === "published").length;
  const views = pages.reduce((s, p) => s + p.views, 0);
  const stats = [
    { key: "total", label: lp.stats.total, hint: lp.stats.totalHint, value: pages.length },
    { key: "live", label: lp.stats.live, hint: lp.stats.liveHint, value: live },
    { key: "draft", label: lp.stats.draft, hint: lp.stats.draftHint, value: pages.length - live },
    { key: "views", label: lp.stats.views, hint: "", value: views },
  ];

  return (
    <>
      <PageHeader title={t.sections.landingPages.title} description={t.sections.landingPages.description} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="landing-stats">
        {stats.map((s) => (
          <Card key={s.key} className="space-y-1" data-stat={s.key}>
            <p className="text-sm text-muted">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums" data-value>
              {s.value}
            </p>
            {s.hint && <p className="text-xs text-muted">{s.hint}</p>}
          </Card>
        ))}
      </div>
      {pages.length === 0 && (
        <div className="mb-4">
          <EmptyState icon={<LayoutTemplate size={40} />} title={lp.emptyTitle}>
            <p>{lp.emptyBody}</p>
          </EmptyState>
        </div>
      )}
      <LandingList
        lang={lang}
        base={base}
        defaultLanguage={shop.defaultLocale === "fr" || shop.defaultLocale === "en" ? shop.defaultLocale : "ar"}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        t={{ landingPages: lp, errors: t.errors, common: t.common }}
        pages={pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          productId: p.productId,
          productName: p.productName,
          image: p.productImages?.[0] ?? null,
          views: p.views,
          orders: p.orders,
          conversion: p.conversion,
          images: p.images,
          formBottom: p.formBottom,
          updated: formatDate(p.updatedAt, lang),
          updatedAt: p.updatedAt.getTime(),
          viewHref: p.status === "published" ? `${store}/lp/${encodeURIComponent(p.slug)}` : null,
        }))}
      />
      {role !== "agent" && (
        <div className="mt-6">
          <AiTestCard test={testAi.bind(null, lang)} t={lp.ai} />
        </div>
      )}
    </>
  );
}
