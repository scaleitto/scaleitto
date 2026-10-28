import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { PageHeader } from "@/ui";
import { planOverview } from "@/features/plans/queries";
import { paymentDetails } from "@/features/plans/billing";
import { CurrentPlan, RequestHistory } from "@/features/plans/views";
import { PlanChooser } from "@/features/plans/PlanChooser";

export default async function PlansPage({ params }: PageProps<"/[lang]/dashboard/plans">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "plans");
  const data = await planOverview(shop.id);
  const pending = data.pending ? { id: data.pending.request.id, planName: data.pending.planName, months: data.pending.request.months, amount: data.pending.request.amount } : null;
  return (
    <>
      <PageHeader title={t.sections.plans.title} description={t.sections.plans.description} />
      <div className="space-y-6">
        <CurrentPlan data={data} lang={lang} t={t} />
        {!data.platform && (
          <PlanChooser
          lang={lang}
          plans={data.plans.map((p) => ({ id: p.id, code: p.code, name: p.name, priceMonthly: p.priceMonthly, limits: p.limits }))}
          currentCode={data.current?.plan.code ?? ""}
          pending={pending}
          payment={paymentDetails()}
          shopName={shop.name}
          t={{ plans: t.plans, errors: t.errors, common: t.common, media: t.media }}
          />
        )}
        <RequestHistory data={data} lang={lang} t={t} />
      </div>
    </>
  );
}
