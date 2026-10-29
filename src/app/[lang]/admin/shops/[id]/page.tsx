import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/server/auth/context";
import { fmt, formatDay, formatPrice } from "@/lib/format";
import { storeUrl } from "@/lib/urls";
import { algeriaParts } from "@/lib/time";
import { limitKeys } from "@/lib/enums";
import { Badge, Card, PageHeader } from "@/ui";
import { adminShop, allPlans } from "@/features/admin/queries";
import { ContractForm, EndContractButton, ShopPlanForm, ShopStatusButton } from "@/features/admin/AdminForms";
import { RequestHistory, UsageMeters } from "@/features/plans/views";

export default async function AdminShop({ params }: PageProps<"/[lang]/admin/shops/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  await requirePlatformAdmin(lang);
  await connection();
  const t = getDictionary(lang);
  const s = t.admin.shop;
  const data = await adminShop(id);
  if (!data) notFound();
  const { shop, overview } = data;
  const plans = (await allPlans()).map((p) => ({ id: p.id, name: p.name }));
  const today = algeriaParts(new Date()).day;
  const text = { admin: t.admin, plans: t.plans, errors: t.errors, common: t.common };
  const rows: [string, string][] = [
    [s.owner, `${data.ownerName} · ${data.ownerEmail}${data.ownerPhone ? ` · ${data.ownerPhone}` : ""}`],
    [s.link, shop.slug],
    [s.domain, shop.customDomain ? `${shop.customDomain}${shop.domainVerifiedAt ? " ✓" : ""}` : "—"],
    [s.members, String(data.members)],
    [s.created, formatDay(shop.createdAt, lang)],
  ];
  return (
    <>
      <PageHeader
        title={shop.name}
        actions={
          <>
            <Badge tone={shop.status === "active" ? "accent" : "danger"}>{t.admin.shops.statuses[shop.status]}</Badge>
            <a href={storeUrl(shop)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
              <ExternalLink size={15} /> {s.openStore}
            </a>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="space-y-3" data-testid="shop-info">
            <h2 className="font-semibold">{s.info}</h2>
            <dl className="space-y-1.5 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-end break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-semibold">{s.plan}</h2>
            <ShopPlanForm lang={lang} shopId={shop.id} plans={plans} planId={shop.planId} expiresOn={shop.planExpiresAt ? algeriaParts(shop.planExpiresAt).day : ""} credits={shop.orderCredits} t={text} />
            <UsageMeters meters={overview.meters} threshold={overview.threshold} t={t} />
          </Card>
          <Card className="space-y-3" data-testid="shop-status">
            <h2 className="font-semibold">{s.status}</h2>
            <p className="text-sm text-muted">{s.suspendHint}</p>
            <ShopStatusButton lang={lang} shopId={shop.id} status={shop.status} t={text} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="space-y-4" data-testid="contracts">
            <h2 className="font-semibold">{s.contracts}</h2>
            {data.contracts.length === 0 ? (
              <p className="text-sm text-muted">{s.noContracts}</p>
            ) : (
              <ul className="space-y-3">
                {data.contracts.map((c) => {
                  const active = c.startDate <= today && (!c.endDate || c.endDate >= today);
                  return (
                    <li key={c.id} className="space-y-1.5 rounded-lg border border-line p-3 text-sm" data-contract={active ? "active" : "ended"}>
                      <div className="flex flex-wrap items-center gap-2">
                        <bdi dir="ltr" className="font-semibold">
                          {c.startDate} → {c.endDate ?? "…"}
                        </bdi>
                        <Badge tone={active ? "accent" : "neutral"}>{active ? s.contractActive : s.contractEnded}</Badge>
                        <span className="ms-auto">{active && <EndContractButton lang={lang} shopId={shop.id} contractId={c.id} t={text} />}</span>
                      </div>
                      <p className="text-xs text-muted">
                        {limitKeys
                          .filter((k) => c.limits[k] != null)
                          .map((k) => `${t.plans.limits[k]}: ${c.limits[k] === -1 ? t.common.unlimited : c.limits[k]}`)
                          .join(" · ")}
                        {c.priceMonthly != null && ` · ${fmt(t.plans.perMonth, { price: formatPrice(c.priceMonthly, t.common.currency) })}`}
                        {` · ${fmt(t.plans.threshold, { n: c.alertThreshold })}`}
                      </p>
                      {c.notes && <p className="text-xs whitespace-pre-line">{c.notes}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-line pt-4">
              <ContractForm lang={lang} shopId={shop.id} today={today} t={text} />
            </div>
          </Card>
          <RequestHistory data={overview} lang={lang} t={t} />
        </div>
      </div>
    </>
  );
}
