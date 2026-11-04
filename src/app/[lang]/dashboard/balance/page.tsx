import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Bot, Coins, CreditCard, Layers, MessageCircle, Package, Plus, Send, TrendingUp } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { fmt, formatDate } from "@/lib/format";
import { Card, PageHeader, buttonClass } from "@/ui";
import { balanceView } from "@/features/credits/queries";
import { CreditPacks } from "@/features/credits/CreditPacks";
import { CREDIT_COSTS, LOW_BALANCE } from "@/features/credits/packs";
import { platformMethods, refreshCreditPurchase } from "@/features/credits/purchases";
import { paymentDetails } from "@/features/plans/billing";
import { quotaPacks } from "@/features/plans/packs";

// Zimam's Balance: the credits, where they came from, this month's spending, credit packs and the full history
export default async function BalancePage({ params, searchParams }: PageProps<"/[lang]/dashboard/balance">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const b = t.balance;
  const { shop } = await requireSection(lang, "balance");
  // Back from the card page: the gateway says how it went
  const purchase = (await searchParams).purchase;
  const bought = typeof purchase === "string" && /^[0-9a-f-]{36}$/.test(purchase) ? await refreshCreditPurchase(shop.id, purchase) : null;
  const v = await balanceView(shop.id);
  const low = v.credits < LOW_BALANCE;
  const kpis = [
    { key: "earned", value: v.earned, icon: TrendingUp, tone: "bg-accent-soft text-accent" },
    { key: "fromSubscription", value: v.fromSubscription, icon: Layers, tone: "bg-info/10 text-info" },
    { key: "purchased", value: v.purchased, icon: CreditCard, tone: "bg-accent-soft text-accent" },
    { key: "spent", value: v.spentThisMonth, icon: ArrowDownRight, tone: "bg-danger/10 text-danger" },
  ] as const;
  const packNames = t.plans.billing.packs as Record<string, string>;
  const label = (kind: string, note: string | null) => {
    // Feature packs bought on the Plans page are written as "pack:<key>"
    const pack = note?.startsWith("pack:") ? packNames[note.slice(5)] : null;
    if (pack) return `${b.featurePack} · ${pack}`;
    return (b.kinds as Record<string, string>)[kind] ?? kind + (note ? ` · ${note}` : "");
  };
  return (
    <>
      <PageHeader
        title={b.title}
        description={b.subtitle}
        actions={
          <Link href="#packs" className={buttonClass("primary")} data-testid="charge-credits">
            <Plus size={16} /> {b.charge}
          </Link>
        }
      />
      {bought && (
        <p className={`mb-4 rounded-xl p-3 text-sm font-semibold ${bought === "paid" ? "bg-accent-soft text-accent-ink" : bought === "rejected" ? "bg-danger/10 text-danger" : "bg-panel-2 text-muted"}`} data-testid="purchase-result" data-result={bought}>
          {bought === "paid" ? b.purchasePaid : bought === "rejected" ? b.purchaseFailed : b.purchasePending}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#062e25] via-[#0b3d30] to-[#0f5a45] p-7 text-white shadow-lg" data-testid="balance-card">
          <Coins size={180} className="absolute -end-8 -top-6 text-white/10" />
          <p className="text-sm font-semibold text-white/80">{b.current}</p>
          <p className="mt-2 flex items-baseline gap-3">
            <span className="text-6xl font-extrabold tabular-nums" data-testid="balance-credits">
              {v.credits.toLocaleString("fr-FR")}
            </span>
            <span className="text-2xl font-bold text-emerald-300">{b.credits}</span>
          </p>
          <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${low ? "border-amber-300/40 bg-amber-300/10 text-amber-200" : "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"}`}>
            <span className={`size-1.5 rounded-full ${low ? "bg-amber-300" : "bg-emerald-300"}`} /> {low ? b.low : b.healthy}
          </span>
          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 text-sm sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.key}>
                <dt className="text-[11px] font-bold tracking-wide text-white/60 uppercase">{b.kpis[k.key]}</dt>
                <dd className="mt-1 font-bold tabular-nums">
                  <bdi dir="ltr">{k.value.toLocaleString("fr-FR")} c</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <Card className="space-y-3 p-6">
          <h2 className="font-semibold">{b.howUsed}</h2>
          {[
            { icon: MessageCircle, label: b.uses.whatsapp, cost: fmt(b.perMessage, { n: CREDIT_COSTS.whatsapp }) },
            { icon: Send, label: b.uses.notification, cost: fmt(b.perMessage, { n: CREDIT_COSTS.notification }) },
            ...quotaPacks.map((p) => ({ icon: p.key === "ai20" ? Bot : Package, label: `${b.featurePack} · ${packNames[p.key]}`, cost: fmt(b.perPack, { n: p.credits.toLocaleString("fr-FR") }) })),
          ].map((u) => (
            <p key={u.label} className="flex items-center gap-3 rounded-xl bg-panel-2 px-4 py-3 text-sm">
              <u.icon size={16} className="text-muted" /> <span className="flex-1">{u.label}</span> <b>{u.cost}</b>
            </p>
          ))}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.key} className="space-y-3 p-5" data-kpi={k.key}>
            <p className="flex items-center gap-2 text-sm text-muted">
              <span className={`grid size-9 place-items-center rounded-lg ${k.tone}`}>
                <k.icon size={17} />
              </span>
              {b.kpis[k.key]}
            </p>
            <p className="text-3xl font-extrabold tabular-nums">{k.value.toLocaleString("fr-FR")}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="space-y-3 p-6">
          <h2 className="font-semibold">{b.recent}</h2>
          {v.history.length === 0 ? (
            <p className="text-sm text-muted">{b.noHistory}</p>
          ) : (
            v.history.slice(0, 6).map((h) => (
              <p key={h.id} className="flex items-center gap-3 rounded-xl bg-panel-2 px-4 py-3 text-sm">
                {h.amount > 0 ? <ArrowUpRight size={16} className="text-accent" /> : <ArrowDownRight size={16} className="text-danger" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{label(h.kind, h.note)}</span>
                  <span className="text-xs text-muted">{formatDate(h.createdAt, lang)}</span>
                </span>
                <b className={h.amount > 0 ? "text-accent-ink" : "text-danger"} dir="ltr">
                  {h.amount > 0 ? "+" : ""}
                  {h.amount} c
                </b>
              </p>
            ))
          )}
        </Card>
        <Card className="scroll-mt-24 space-y-3 p-6" id="packs">
          <h2 className="font-semibold">{b.packsTitle}</h2>
          <CreditPacks
            lang={lang}
            online={platformMethods().map((m) => m.method)}
            names={t.orderPage.online}
            payment={paymentDetails()}
            pending={v.pending.map((p) => ({ id: p.id, credits: p.credits, method: p.method, at: formatDate(p.createdAt, lang) }))}
            t={{ balance: b, plans: t.plans, errors: t.errors, common: t.common, media: t.media }}
          />
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto p-0" data-testid="credit-history">
        <h2 className="p-5 pb-3 font-semibold">{b.history}</h2>
        {v.history.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">{b.noHistory}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {(["action", "credits", "type", "after", "date"] as const).map((k) => (
                  <th key={k} className="text-start">
                    {b.columns[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.history.map((h) => (
                <tr key={h.id} data-ledger={h.kind}>
                  <td>{label(h.kind, h.note)}</td>
                  <td className={h.amount > 0 ? "font-semibold text-accent-ink" : "font-semibold text-danger"} dir="ltr">
                    {h.amount > 0 ? "+" : ""}
                    {h.amount} c
                  </td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${h.amount > 0 ? "bg-accent-soft text-accent-ink" : "bg-danger/10 text-danger"}`}>{h.amount > 0 ? b.credit : b.debit}</span>
                  </td>
                  <td className="tabular-nums">{h.balanceAfter.toLocaleString("fr-FR")}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(h.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
