import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { fmt, formatDate } from "@/lib/format";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/ui";
import { listLeads, recoveryStats, PAGE_SIZE } from "@/features/orders/queries";
import { LeadActions } from "@/features/orders/LeadActions";
import { fillRecovery, recoveryTemplates, suggestedStep } from "@/features/orders/recovery";
import { resolveMessages } from "@/features/messages/templates";

// Orders → Abandoned carts: visitors who typed their phone and left, with the way to bring each one back
// (the suggested step first: call, WhatsApp message, an offer, or take the order on the phone).
export default async function AbandonedPage({ params, searchParams }: PageProps<"/[lang]/dashboard/orders/abandoned">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const o = t.orders;
  const r = o.recovery;
  const { shop } = await requireSection(lang, "abandoned");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const now = new Date();
  const [{ rows, total }, stats] = await Promise.all([listLeads(shop.id, page), recoveryStats(shop.id, new Date(now.getTime() - 30 * 86_400_000))]);
  const base = sectionHref(lang, "abandoned");
  const text = { orders: t.orders, errors: t.errors, common: t.common };
  // Messages in the store's message language (Call centers → settings)
  const templates = recoveryTemplates[resolveMessages(shop.messages).language];
  const store = storeUrl(shop);
  const wilayaList = wilayas.map((w) => ({ code: w.code, name: `${w.code} - ${wilayaName(w.code, lang)}` }));

  return (
    <>
      <PageHeader title={t.sections.abandoned.title} description={t.sections.abandoned.description} />
      <p className="mb-4 text-sm text-muted">{r.hint}</p>
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="recovery-stats">
        {(
          [
            ["total", r.stats.total, stats.total],
            ["abandoned", r.stats.abandoned, stats.abandoned],
            ["contacted", r.stats.contacted, stats.contacted],
            ["converted", r.stats.converted, `${stats.converted} · ${stats.rate}%`],
          ] as const
        ).map(([key, label, value]) => (
          <div key={key} className="rounded-xl border border-line bg-panel px-4 py-3" data-stat={key}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {total === 0 ? (
        <EmptyState icon={<ShoppingBasket size={40} />} title={o.leadsEmpty} />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const hoursAgo = (now.getTime() - row.updatedAt.getTime()) / 3_600_000;
              const status = row.status as "abandoned" | "contacted";
              const step = suggestedStep({ status, hoursAgo });
              const vars = {
                name: row.name ?? "",
                product: `${row.productName ?? ""}${row.variantTitle ? ` (${row.variantTitle})` : ""}`,
                link: row.productSlug ? `${store}/p/${encodeURIComponent(row.productSlug)}` : store,
                store: shop.name,
              };
              return (
                <li key={row.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]" data-lead={row.phone} data-step={step}>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      {row.name || "—"}
                      <Badge tone={status === "contacted" ? "info" : "warning"}>{o.leadStatuses[status]}</Badge>
                    </p>
                    <p className="text-xs text-muted" dir="ltr">
                      {row.phone}
                    </p>
                    <p className="text-xs text-muted">
                      {row.productName ?? "—"}
                      {row.variantTitle && ` · ${row.variantTitle}`} {fmt(o.quantityShort, { n: row.quantity })}
                      {row.wilayaCode ? ` · ${wilayaName(row.wilayaCode, lang)}` : ""}
                    </p>
                    <p className="text-xs text-muted">{formatDate(row.updatedAt, lang)}</p>
                    <p className="text-xs font-semibold text-accent">{fmt(r.suggested, { step: r.steps[step] })}</p>
                  </div>
                  <LeadActions
                    lang={lang}
                    lead={{ id: row.id, phone: row.phone, name: row.name ?? "", wilayaCode: row.wilayaCode, quantity: row.quantity, status }}
                    step={step}
                    messages={{ message: fillRecovery(templates.message, vars), offer: fillRecovery(templates.offer, { ...vars, offer: "{offer}" }) }}
                    wilayas={wilayaList}
                    orderBase={sectionHref(lang, "orders")}
                    t={text}
                  />
                </li>
              );
            })}
          </ul>
          {total > PAGE_SIZE && (
            <div className="flex justify-end gap-2 border-t border-line p-4">
              {page > 1 && (
                <Link href={`${base}?page=${page - 1}`} className={buttonClass("secondary")}>
                  {t.common.previous}
                </Link>
              )}
              {page * PAGE_SIZE < total && (
                <Link href={`${base}?page=${page + 1}`} className={buttonClass("secondary")}>
                  {t.common.next}
                </Link>
              )}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
