import Link from "next/link";
import { Coins, Wallet } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt } from "@/lib/format";
import { Alert, Card } from "@/ui";
import { planOverview } from "@/features/plans/queries";
import { onlinePlanMethods, paymentDetails, refreshPlanPayment } from "@/features/plans/billing";
import { CurrentPlan, RequestHistory } from "@/features/plans/views";
import { FeaturePacks, PlanChooser } from "@/features/plans/PlanChooser";
import { nextDiscountPreview } from "@/features/referrals/referrals";

// Plans = Zimam's "Subscription & Billing": the credit balance, current plan, invoices, the plans with the payment method and
// the prepaid term, the balance and the feature packs
export default async function PlansPage({ params, searchParams }: PageProps<"/[lang]/dashboard/plans">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const b = t.plans.billing;
  const { shop } = await requireSection(lang, "plans");
  // Back from an online payment: the gateway is asked how it went
  const back = (await searchParams).request;
  const paid = typeof back === "string" && /^[\w-]{1,36}$/.test(back) ? await refreshPlanPayment(shop.id, back) : null;
  const data = await planOverview(shop.id);
  const pending = data.pending ? { id: data.pending.request.id, planName: data.pending.planName, months: data.pending.request.months, orderPack: data.pending.orderPack, amount: data.pending.request.amount } : null;
  const balanceHref = sectionHref(lang, "balance");
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-[1.7rem]">{b.title}</h1>
          <p className="mt-1.5 text-sm text-muted">{b.hint}</p>
        </div>
        <Link href={balanceHref} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold hover:bg-panel-2" data-testid="credit-pill">
          <Coins size={15} className="text-accent" /> {fmt(b.creditPill, { n: shop.credits.toLocaleString("fr-FR") })}
        </Link>
      </div>
      <div className="space-y-6">
        {paid && <Alert variant={paid === "approved" ? "success" : paid === "rejected" ? "error" : "info"}>{paid === "approved" ? b.paid : paid === "rejected" ? b.paidFailed : b.paidPending}</Alert>}
        <CurrentPlan data={data} lang={lang} t={t} />
        <RequestHistory data={data} lang={lang} t={t} />
        <PlanChooser
          lang={lang}
          plans={data.plans.map((p) => ({ id: p.id, code: p.code, name: p.name, priceMonthly: p.priceMonthly, orderPack: p.orderPack, limits: p.limits, features: p.features }))}
          currentCode={data.current?.plan.code ?? ""}
          pending={pending}
          payment={paymentDetails()}
          shopName={shop.name}
          referral={await nextDiscountPreview(shop.id)}
          online={onlinePlanMethods()}
          t={{ plans: t.plans, errors: t.errors, common: t.common, media: t.media }}
        />
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Wallet size={18} className="text-accent" /> {b.balanceTitle}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{b.balanceHint}</p>
          </div>
          <Link href={balanceHref} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-panel-2">
            {b.openBalance}
          </Link>
        </Card>
        <FeaturePacks lang={lang} credits={shop.credits} t={{ plans: t.plans, errors: t.errors, common: t.common, media: t.media }} />
      </div>
    </>
  );
}
