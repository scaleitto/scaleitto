import { ChartColumn, Eye, EyeOff, LayoutTemplate } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { Card } from "@/ui";
import { formatDate } from "@/lib/format";
import { listLandingPages, productChoices } from "@/features/landing/queries";
import { LandingList } from "@/features/landing/LandingList";
import { CreateLanding } from "@/features/landing/CreateLanding";

// Landing pages (Zimam): four counters, then the list with its filters and the create window
export default async function LandingPagesPage({ params }: PageProps<"/[lang]/dashboard/landing-pages">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const lp = t.landingPages;
  const { shop } = await requireSection(lang, "landingPages");
  const [pages, products] = await Promise.all([listLandingPages(shop.id), productChoices(shop.id)]);
  const base = sectionHref(lang, "landingPages");
  const store = storeUrl(shop);
  const live = pages.filter((p) => p.status === "published").length;
  const views = pages.reduce((s, p) => s + p.views, 0);
  const stats = [
    { key: "total", icon: LayoutTemplate, tone: "bg-panel-2 text-fg-2", label: lp.stats.total, hint: lp.stats.totalHint, value: pages.length },
    { key: "live", icon: Eye, tone: "bg-accent-soft text-accent-ink", label: lp.stats.live, hint: lp.stats.liveHint, value: live },
    { key: "draft", icon: EyeOff, tone: "bg-panel-2 text-fg-2", label: lp.stats.draft, hint: lp.stats.draftHint, value: pages.length - live },
    { key: "views", icon: ChartColumn, tone: "bg-violet-soft text-violet", label: lp.stats.views, hint: "—", value: views },
  ];

  return (
    <>
      <CreateLanding
        lang={lang}
        base={base}
        title={t.sections.landingPages.title}
        description={t.sections.landingPages.description}
        products={products.map((p) => ({ id: p.id, name: p.name, price: p.price, image: (p.images as string[] | null)?.[0] ?? null, draft: p.status !== "active" }))}
        t={{ landingPages: lp, errors: t.errors, common: t.common, media: t.media }}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="landing-stats">
        {stats.map((s) => (
          <Card key={s.key} className="space-y-3" data-stat={s.key}>
            <p className="flex items-center gap-2.5 text-sm font-semibold text-fg-2">
              <span className={`grid size-9 place-items-center rounded-xl ${s.tone}`}>
                <s.icon size={18} aria-hidden />
              </span>
              {s.label}
            </p>
            <p className="text-3xl font-bold tabular-nums" data-value>
              {s.value}
            </p>
            <p className="text-xs text-muted">{s.hint}</p>
          </Card>
        ))}
      </div>
      <LandingList
        lang={lang}
        base={base}
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
          url: `${store}/lp/${encodeURIComponent(p.slug)}`,
        }))}
      />
    </>
  );
}
