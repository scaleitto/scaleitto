import Link from "next/link";
import { connection } from "next/server";
import { getDictionary, asLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/server/auth/context";
import { fmt, formatPrice } from "@/lib/format";
import { Card, PageHeader } from "@/ui";
import { platformOverview } from "@/features/admin/queries";

export default async function AdminOverview({ params }: PageProps<"/[lang]/admin">) {
  const lang = asLocale((await params).lang);
  await requirePlatformAdmin(lang);
  await connection();
  const t = getDictionary(lang);
  const o = t.admin.overview;
  const d = await platformOverview();
  const cur = t.common.currency;
  const tiles = [
    { id: "shops", label: o.shops, value: d.shops, hint: fmt(o.activeOf, { active: d.activeShops, total: d.shops }), href: "/shops" },
    { id: "new", label: o.newShops, value: d.newShops },
    { id: "orders", label: o.orders, value: d.ordersThisMonth, hint: fmt(o.gmv, { amount: formatPrice(d.gmvThisMonth, cur) }) },
    { id: "pending", label: o.pending, value: d.pendingRequests, href: "/plan-requests", alert: d.pendingRequests > 0 },
    { id: "revenue", label: o.revenue, value: formatPrice(d.revenueThisMonth, cur) },
    { id: "errors", label: o.errors, value: d.errors24h, href: "/system", alert: d.errors24h > 0 },
  ];
  return (
    <>
      <PageHeader title={t.admin.nav.overview} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((tile) => {
          const body = (
            <Card className={`h-full space-y-1 p-4 ${tile.alert ? "border-amber-400/50" : ""}`} data-tile={tile.id}>
              <p className="text-xs text-muted">{tile.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${tile.alert ? "text-amber-300" : ""}`} data-value>
                {tile.value}
              </p>
              {tile.hint && <p className="text-xs text-muted">{tile.hint}</p>}
            </Card>
          );
          return tile.href ? (
            <Link key={tile.id} href={`/${lang}/admin${tile.href}`} className="block transition hover:opacity-90">
              {body}
            </Link>
          ) : (
            <div key={tile.id}>{body}</div>
          );
        })}
      </div>
      <Card className="space-y-2">
        <h2 className="font-semibold">{o.byPlan}</h2>
        <ul className="space-y-1 text-sm">
          {d.byPlan.map((p) => (
            <li key={p.name} className="flex justify-between">
              <span>{p.name}</span>
              <span className="font-semibold tabular-nums">{p.n}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
