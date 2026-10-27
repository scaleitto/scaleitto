import Link from "next/link";
import { ImageOff, LayoutTemplate, Plus } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/ui";
import { listLandingPages } from "@/features/landing/queries";
import { PageActions } from "@/features/landing/PageActions";
import { AiTestCard } from "@/features/landing/AiTestCard";
import { testAi } from "@/features/landing/ai-actions";

export default async function LandingPagesPage({ params }: PageProps<"/[lang]/dashboard/landing-pages">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const lp = t.landingPages;
  const { shop, role } = await requireSection(lang, "landingPages");
  const pages = await listLandingPages(shop.id);
  const base = sectionHref(lang, "landingPages");
  const store = storeUrl(shop);
  const text = { landingPages: lp, errors: t.errors, common: t.common };

  return (
    <>
      <PageHeader
        title={t.sections.landingPages.title}
        description={t.sections.landingPages.description}
        actions={
          <Link href={`${base}/new`} className={buttonClass("primary")}>
            <Plus size={16} /> {lp.newPage}
          </Link>
        }
      />
      {pages.length === 0 ? (
        <EmptyState icon={<LayoutTemplate size={40} />} title={lp.emptyTitle}>
          <p>{lp.emptyBody}</p>
          <Link href={`${base}/new`} className={buttonClass("primary", "mt-4")}>
            <Plus size={16} /> {lp.newPage}
          </Link>
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="p-3 text-start font-medium">{lp.columns.page}</th>
                <th className="hidden p-3 text-start font-medium sm:table-cell">{lp.columns.status}</th>
                <th className="p-3 text-start font-medium">{lp.columns.views}</th>
                <th className="p-3 text-start font-medium">{lp.columns.orders}</th>
                <th className="hidden p-3 text-start font-medium sm:table-cell">{lp.columns.conversion}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0" data-page={p.title}>
                  <td className="p-3">
                    <Link href={`${base}/${p.id}`} className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-bg">
                        {p.productImages?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.productImages[0]} alt="" className="size-full object-cover" />
                        ) : (
                          <ImageOff size={18} className="text-muted" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{p.title}</span>
                        <span className="block truncate text-xs text-muted">{p.productName}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden p-3 sm:table-cell">
                    <Badge tone={p.status === "published" ? "accent" : "neutral"}>{lp.statuses[p.status]}</Badge>
                  </td>
                  <td className="p-3 font-semibold">{p.views}</td>
                  <td className="p-3 font-semibold">{p.orders}</td>
                  <td className="hidden p-3 font-semibold sm:table-cell">{p.conversion == null ? "—" : `${p.conversion}%`}</td>
                  <td className="p-2">
                    <PageActions lang={lang} id={p.id} editHref={`${base}/${p.id}`} viewHref={p.status === "published" ? `${store}/lp/${encodeURIComponent(p.slug)}` : null} t={text} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {role !== "agent" && (
        <div className="mt-6">
          <AiTestCard test={testAi.bind(null, lang)} t={lp.ai} />
        </div>
      )}
    </>
  );
}
