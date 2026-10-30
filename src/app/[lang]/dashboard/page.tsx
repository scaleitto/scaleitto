import Link from "next/link";
import { connection } from "next/server";
import { ArrowDownRight, ArrowUpRight, Boxes, CircleCheck, Circle, Package, ShieldAlert, ShoppingCart, Truck } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { algeriaParts } from "@/lib/time";
import { Badge, Card, buttonClass } from "@/ui";
import { overviewData } from "@/features/analytics/overview";
import { lowStockCount } from "@/features/inventory/queries";
import { statusTone } from "@/features/orders/statuses";

// The dashboard home (Zimam's layout): greeting, what needs the merchant, four numbers for the last 7 days, the sales
// chart, best sellers, the latest orders and the set-up checklist.
export default async function OverviewPage({ params }: PageProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { user, shop } = await requireSection(lang, "overview");
  await connection();
  const now = new Date();
  const [data, lowStock] = await Promise.all([overviewData(shop.id, now), lowStockCount(shop.id)]);
  const o = t.overview;
  const cur = t.common.currency;
  const hour = Math.floor(algeriaParts(now).minutes / 60);
  const greeting = hour < 12 ? o.morning : hour < 18 ? o.afternoon : o.evening;
  const orders = sectionHref(lang, "orders");
  const todo = [
    data.attention.pending > 0 && { key: "pending", icon: ShoppingCart, text: fmt(o.todo.pending, { n: data.attention.pending }), href: `${orders}?status=pending` },
    data.attention.flagged > 0 && { key: "flagged", icon: ShieldAlert, text: fmt(o.todo.flagged, { n: data.attention.flagged }), href: `${orders}?status=flagged` },
    lowStock > 0 && { key: "lowStock", icon: Boxes, text: fmt(o.todo.lowStock, { n: lowStock }), href: sectionHref(lang, "inventory") },
    data.attention.noCarrier && { key: "noCarrier", icon: Truck, text: o.todo.noCarrier, href: sectionHref(lang, "delivery") },
  ].filter((x) => x !== false);
  const steps = (["products", "delivery", "storeDesign", "pixels"] as const).map((key) => ({ key, done: data.checklist[key] }));
  const doneSteps = steps.filter((s) => s.done).length;
  const maxSales = Math.max(1, ...data.days.map((d) => d.sales));

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4" data-testid="welcome">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">{fmt(greeting, { name: user.name })}</h1>
          <p className="mt-1 text-sm text-muted">{o.subtitle}</p>
        </div>
        <Link href={orders} className={buttonClass("primary")}>
          <ShoppingCart size={16} /> {o.openOrders}
        </Link>
      </section>

      <Card className="space-y-3" data-testid="attention">
        <h2 className="font-semibold">{o.attention}</h2>
        {todo.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <CircleCheck size={16} className="text-accent" /> {o.allClear}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {todo.map(({ key, icon: Icon, text, href }) => (
              <li key={key}>
                <Link href={href} data-todo={key} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm font-medium hover:border-warning/40 hover:bg-warning-soft">
                  <Icon size={17} className="shrink-0 text-warning" /> {text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="overview-stats">
        {data.kpis.map(({ key, value, change }) => (
          <Card key={key} className="space-y-2" data-stat={key}>
            <p className="text-sm text-muted">{o.kpis[key]}</p>
            <p className="text-2xl font-bold tabular-nums" data-value>
              {key === "sales" ? formatPrice(value, cur) : value}
            </p>
            {change !== null && (
              <p className={`flex items-center gap-1 text-xs font-semibold ${change >= 0 ? "text-accent" : "text-danger"}`} title={o.vsPrev}>
                {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {Math.abs(change)}%
              </p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2" data-testid="sales-chart">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{o.salesTitle}</h2>
            <span className="rounded-lg bg-panel-2 px-2.5 py-1 text-xs font-semibold text-muted">{o.last7}</span>
          </div>
          {/* Bars stay left-to-right in every language (time reads that way on charts) */}
          <div dir="ltr" className="flex h-48 items-end gap-2">
            {data.days.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" data-day={d.day}>
                <div className="rounded-t-md bg-accent/80 transition-colors group-hover:bg-accent" style={{ height: `${Math.max(2, (d.sales / maxSales) * 100)}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-fg px-2 py-1 text-xs whitespace-nowrap text-panel group-hover:block">
                  {formatPrice(d.sales, cur)} · {fmt(o.ordersCount, { n: d.orders })}
                </span>
                <span className="mt-1 text-center text-[11px] text-muted tabular-nums">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-3" data-testid="best-sellers">
          <h2 className="font-semibold">{o.best}</h2>
          {data.best.length === 0 ? (
            <p className="text-sm text-muted">{o.noSales}</p>
          ) : (
            <ul className="space-y-2">
              {data.best.map((b) => (
                <li key={b.name} className="flex items-center gap-3 text-sm">
                  {b.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.image} alt="" className="size-9 rounded-lg border border-line object-cover" />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-lg bg-panel-2 text-muted">
                      <Package size={16} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="text-xs text-muted">{fmt(o.sold, { n: b.quantity })}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatPrice(b.total, cur)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2" data-testid="latest-orders">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{o.latest}</h2>
            <Link href={orders} className="text-sm font-semibold text-accent hover:underline">
              {o.viewAll}
            </Link>
          </div>
          {data.latest.length === 0 ? (
            <p className="text-sm text-muted">{o.noOrders}</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.latest.map((r) => (
                <li key={r.id}>
                  <Link href={`${orders}/${r.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-accent">
                    <span className="font-semibold tabular-nums">#{r.number}</span>
                    <span className="min-w-0 flex-1 truncate">{r.customerName || "—"}</span>
                    <span className="hidden text-xs text-muted sm:inline">{formatDate(r.createdAt, lang)}</span>
                    <Badge tone={statusTone[r.status]}>{t.orders.statuses[r.status]}</Badge>
                    <span className="w-24 text-end font-semibold tabular-nums">{formatPrice(r.total, cur)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3" data-testid="checklist">
          <div>
            <h2 className="font-semibold">{o.checklist}</h2>
            <p className="text-xs text-muted">{fmt(o.progress, { done: doneSteps, left: steps.length - doneSteps })}</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(doneSteps / steps.length) * 100}%` }} />
          </div>
          <ul className="space-y-1">
            {steps.map(({ key, done }) => (
              <li key={key}>
                <Link href={sectionHref(lang, key)} data-step={key} data-done={done} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-panel-2">
                  {done ? <CircleCheck size={17} className="text-accent" /> : <Circle size={17} className="text-muted" />}
                  <span className={done ? "text-muted line-through" : "font-medium"}>{o.steps[key]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
