import Link from "next/link";
import { connection } from "next/server";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt, formatDate, formatPrice } from "@/lib/format";
import { algeriaParts } from "@/lib/time";
import { Card, PageHeader } from "@/ui";
import { resolveRange } from "@/features/analytics/range";
import { Kpi, PeriodBar } from "@/features/analytics/views";
import { owedByCouriers, shopFinance } from "@/features/finance/queries";
import { DeleteExpense, ExpenseForm, PaidPanel } from "@/features/finance/components";
import { addExpense } from "@/features/finance/actions";

// Finance (owner only): what the delivered orders earned, what the couriers still hold, what was spent, the net profit
export default async function FinancePage({ params, searchParams }: PageProps<"/[lang]/dashboard/finance">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const f = t.finance;
  const k = f.kpis;
  const { shop } = await requireSection(lang, "finance");
  await connection();
  const range = resolveRange(await searchParams);
  const [data, owed] = await Promise.all([shopFinance(shop.id, range), owedByCouriers(shop.id)]);
  const money = (n: number) => formatPrice(n, t.common.currency);
  const owedTotal = owed.reduce((s, o) => s + o.total, 0);
  const byCarrier = [...owed.reduce((m, o) => m.set(o.carrier ?? "", (m.get(o.carrier ?? "") ?? 0) + o.total), new Map<string, number>()).entries()];
  const text = { finance: t.finance, orders: t.orders, errors: t.errors, delivery: t.delivery, common: t.common };

  return (
    <>
      <PageHeader title={t.sections.finance.title} description={t.sections.finance.description} />
      <PeriodBar base={sectionHref(lang, "finance")} range={range} t={t} />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="finance-kpis">
        <Kpi id="sales" label={k.sales} value={money(data.sales)} hint={fmt(k.salesHint, { n: data.delivered })} />
        <Kpi id="cost" label={k.cost} value={money(data.cost)} hint={data.costMissing ? k.costMissing : k.costHint} />
        <Kpi id="expenses" label={k.expenses} value={money(data.expenses)} hint={k.expensesHint} />
        <Kpi id="net" label={k.net} value={<span className={data.net < 0 ? "text-danger" : "text-accent"}>{money(data.net)}</span>} hint={data.margin == null ? k.netHint : fmt(k.margin, { n: data.margin })} />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi id="perOrder" label={k.perOrder} value={data.perOrder == null ? "—" : money(data.perOrder)} />
        <Kpi id="costPerDelivered" label={k.costPerDelivered} value={data.costPerDelivered == null ? "—" : money(data.costPerDelivered)} />
        <Kpi id="owed" label={k.owed} value={money(owedTotal)} hint={fmt(k.owedHint, { n: owed.length })} />
        <Kpi id="collected" label={k.collected} value={money(data.collected.amount)} hint={fmt(k.collectedHint, { n: data.collected.n })} />
      </div>

      {/* Cash on delivery the couriers still hold */}
      <Card className="mb-6 p-0" data-testid="owed">
        <div className="space-y-1 border-b border-line p-4">
          <h2 className="font-semibold">{f.owedTitle}</h2>
          <p className="text-sm text-muted">{f.owedIntro}</p>
          {byCarrier.length > 0 && (
            <ul className="flex flex-wrap gap-2 pt-2 text-sm" aria-label={f.byCarrier} data-testid="owed-by-carrier">
              {byCarrier.map(([carrier, amount]) => (
                <li key={carrier} className="rounded-lg bg-panel-2 px-3 py-1.5">
                  {carrier || f.noCarrier}: <span className="font-semibold tabular-nums">{money(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {owed.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{f.owedEmpty}</p>
        ) : (
          <>
            <div className="border-b border-line bg-panel-2/50 p-3">
              <PaidPanel lang={lang} t={text} />
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="w-10 p-3" />
                    <th className="p-3 text-start font-medium">{f.columns.order}</th>
                    <th className="hidden p-3 text-start font-medium sm:table-cell">{f.columns.customer}</th>
                    <th className="p-3 text-start font-medium">{f.columns.carrier}</th>
                    <th className="p-3 text-start font-medium">{f.columns.amount}</th>
                    <th className="hidden p-3 text-start font-medium md:table-cell">{f.columns.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {owed.map((o) => (
                    <tr key={o.id} className="border-b border-line last:border-0" data-owed={o.number}>
                      <td className="p-3">
                        <input type="checkbox" data-bulk-order data-number={o.number} value={o.id} aria-label={`#${o.number}`} className="size-4 accent-[var(--color-accent)]" />
                      </td>
                      <td className="p-3 font-bold">
                        <Link href={`${sectionHref(lang, "orders")}/${o.id}`} className="hover:text-accent">
                          #{o.number}
                        </Link>
                      </td>
                      <td className="hidden p-3 sm:table-cell">{o.customerName}</td>
                      <td className="p-3 text-muted">
                        {o.carrier ?? f.noCarrier}
                        {o.tracking && (
                          <span className="block text-xs" dir="ltr">
                            {o.tracking}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold tabular-nums">{money(o.total)}</td>
                      <td className="hidden p-3 text-xs text-muted md:table-cell">{formatDate(o.createdAt, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Expenses of the period */}
      <section className="space-y-3" data-testid="expenses">
        <div>
          <h2 className="text-lg font-bold">{f.expensesTitle}</h2>
          <p className="text-sm text-muted">{f.expensesIntro}</p>
        </div>
        <ExpenseForm today={algeriaParts(new Date()).day} action={addExpense.bind(null, lang)} t={text} />
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Card className="overflow-x-auto p-0">
            {data.expenseList.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted">{f.expensesEmpty}</p>
            ) : (
              <table className="w-full text-sm" data-testid="expense-list">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="p-3 text-start font-medium">{f.day}</th>
                    <th className="p-3 text-start font-medium">{f.category}</th>
                    <th className="p-3 text-start font-medium">{f.columns.amount}</th>
                    <th className="hidden p-3 text-start font-medium sm:table-cell">{f.note}</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.expenseList.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0" data-expense={e.category}>
                      <td className="p-3 text-xs whitespace-nowrap text-muted" dir="ltr">
                        {e.day}
                      </td>
                      <td className="p-3">{f.categories[e.category]}</td>
                      <td className="p-3 font-semibold tabular-nums">{money(e.amount)}</td>
                      <td className="hidden p-3 text-muted sm:table-cell">{e.note}</td>
                      <td className="p-2 text-end">
                        <DeleteExpense lang={lang} id={e.id} t={text} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {data.categories.length > 0 && (
            <Card className="space-y-3" data-testid="expense-breakdown">
              <h3 className="font-semibold">{f.breakdown}</h3>
              {data.categories.map((c) => (
                <div key={c.category} data-category={c.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{f.categories[c.category]}</span>
                    <span className="font-semibold tabular-nums">{money(c.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${data.expenses ? (c.amount / data.expenses) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
