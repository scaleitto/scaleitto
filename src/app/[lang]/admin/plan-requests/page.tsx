import { connection } from "next/server";
import { getDictionary, asLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/server/auth/context";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/ui";
import { adminPlanRequests } from "@/features/plans/queries";
import { DecideRequest } from "@/features/plans/AdminRequests";
import { pendingCreditPurchases } from "@/features/credits/queries";
import { periodLabel } from "@/features/plans/labels";

// Platform admin: plan upgrade requests
export default async function PlanRequestsAdmin({ params }: PageProps<"/[lang]/admin/plan-requests">) {
  const lang = asLocale((await params).lang);
  await requirePlatformAdmin(lang);
  await connection();
  const t = getDictionary(lang);
  const a = t.admin;
  const [rows, credits] = await Promise.all([adminPlanRequests(), pendingCreditPurchases()]);
  return (
    <>
      <PageHeader title={a.title} />
      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted">{a.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                {(["shop", "plan", "months", "amount", "method", "receipt", "date", "status"] as const).map((k) => (
                  <th key={k} className="p-3 text-start font-medium whitespace-nowrap">
                    {a.columns[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ request: r, planName, orderPack, shopName, shopSlug }) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0" data-request-row={shopSlug}>
                  <td className="p-3">
                    <span className="block font-semibold">{shopName}</span>
                    <span className="text-xs text-muted" dir="ltr">
                      {shopSlug}
                    </span>
                    {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
                  </td>
                  <td className="p-3">{planName}</td>
                  <td className="p-3 whitespace-nowrap">{periodLabel(r.months, orderPack, t)}</td>
                  <td className="p-3 font-semibold whitespace-nowrap">{formatPrice(r.amount, t.common.currency)}</td>
                  <td className="p-3">{t.plans.request.methods[r.method]}</td>
                  <td className="p-3">
                    {r.receiptUrl ? (
                      <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                        {a.viewReceipt}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap text-muted">
                    <bdi>{formatDate(r.createdAt, lang)}</bdi>
                  </td>
                  <td className="p-3">
                    {r.status === "pending" ? (
                      <DecideRequest lang={lang} id={r.id} t={a} />
                    ) : (
                      <>
                        <Badge tone={r.status === "approved" ? "accent" : r.status === "rejected" ? "danger" : "neutral"}>{t.plans.statuses[r.status]}</Badge>
                        {r.adminNote && <p className="mt-1 text-xs text-muted">{r.adminNote}</p>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="mt-6 overflow-x-auto p-0" data-testid="credit-requests">
        <h2 className="p-4 pb-2 font-semibold">{a.creditRequests}</h2>
        {credits.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">{a.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {credits.map(({ purchase: r, shopName, shopSlug }) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0" data-credit-row={shopSlug}>
                  <td className="p-3">
                    <span className="block font-semibold">{shopName}</span>
                    {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
                  </td>
                  <td className="p-3 font-semibold whitespace-nowrap">{r.credits.toLocaleString("fr-FR")} c</td>
                  <td className="p-3 font-semibold whitespace-nowrap">{formatPrice(r.amount, t.common.currency)}</td>
                  <td className="p-3">{r.method === "card" ? "💳" : t.plans.request.methods[r.method]}</td>
                  <td className="p-3">
                    {r.receiptUrl ? (
                      <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                        {a.viewReceipt}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap text-muted">
                    <bdi>{formatDate(r.createdAt, lang)}</bdi>
                  </td>
                  <td className="p-3">
                    <DecideRequest lang={lang} id={r.id} kind="credits" t={a} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
