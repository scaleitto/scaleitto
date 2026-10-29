import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/server/auth/context";
import { fmt, formatDay } from "@/lib/format";
import { Badge, Card, PageHeader, buttonClass, inputClass } from "@/ui";
import { listShops } from "@/features/admin/queries";

export default async function AdminShops({ params, searchParams }: PageProps<"/[lang]/admin/shops">) {
  const lang = asLocale((await params).lang);
  await requirePlatformAdmin(lang);
  await connection();
  const t = getDictionary(lang);
  const s = t.admin.shops;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q);
  const status = one(sp.status) === "active" || one(sp.status) === "suspended" ? (one(sp.status) as "active" | "suspended") : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { rows, total, pageSize } = await listShops({ q, status, page });
  const base = `/${lang}/admin/shops`;
  const href = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q, status, page: undefined, ...patch }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    return p.size ? `${base}?${p}` : base;
  };
  return (
    <>
      <PageHeader title={`${t.admin.nav.shops} (${total})`} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form action={base} className="relative min-w-60 flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder={s.search} className={`${inputClass} ps-9`} />
          {status && <input type="hidden" name="status" value={status} />}
        </form>
        <nav className="flex gap-1 rounded-lg bg-panel p-1 text-sm">
          {([undefined, "active", "suspended"] as const).map((st) => (
            <Link key={st ?? "all"} href={href({ status: st })} aria-current={status === st ? "page" : undefined} className={`rounded-md px-3 py-1.5 font-medium ${status === st ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}>
              {st ? s.statuses[st] : s.all}
            </Link>
          ))}
        </nav>
      </div>
      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted">{s.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                {(["shop", "owner", "plan", "orders", "status", "created"] as const).map((k) => (
                  <th key={k} className="p-3 text-start font-medium whitespace-nowrap">
                    {s.columns[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="relative border-b border-line last:border-0 hover:bg-panel-2/40" data-shop={r.slug}>
                  <td className="p-3">
                    <Link href={`${base}/${r.id}`} className="font-semibold after:absolute after:inset-0">
                      {r.name}
                    </Link>
                    <span className="block text-xs text-muted" dir="ltr">
                      {r.slug}
                    </span>
                  </td>
                  <td className="p-3 text-muted" dir="ltr">
                    {r.ownerEmail}
                    {!r.ownerVerified && <span className="ms-1 rounded-full bg-warning/10 px-1.5 text-[11px] font-semibold text-warning">{s.unverified}</span>}
                    {r.ownerPhone && <span className="block text-xs">{r.ownerPhone}</span>}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {r.planName}
                    {r.planExpiresAt && <span className="block text-xs text-muted">{fmt(s.until, { date: formatDay(r.planExpiresAt, lang) })}</span>}
                  </td>
                  <td className="p-3 whitespace-nowrap tabular-nums">
                    <bdi dir="ltr">
                      {r.ordersThisMonth} / {r.orderLimit === -1 ? "∞" : r.orderLimit}
                    </bdi>
                  </td>
                  <td className="p-3">
                    <Badge tone={r.status === "active" ? "accent" : "danger"}>{s.statuses[r.status]}</Badge>
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap text-muted">{formatDay(r.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {total > pageSize && (
        <div className="mt-4 flex gap-2">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className={buttonClass("secondary")}>
              {t.common.previous}
            </Link>
          )}
          {page * pageSize < total && (
            <Link href={href({ page: page + 1 })} className={buttonClass("secondary")}>
              {t.common.next}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
