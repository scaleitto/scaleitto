import { connection } from "next/server";
import { getDictionary, asLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/server/auth/context";
import { PageHeader } from "@/ui";
import { PlanEditor } from "@/features/admin/AdminForms";
import { allPlans } from "@/features/admin/queries";

export default async function AdminPlans({ params }: PageProps<"/[lang]/admin/plans">) {
  const lang = asLocale((await params).lang);
  await requirePlatformAdmin(lang);
  await connection();
  const t = getDictionary(lang);
  const plans = await allPlans();
  return (
    <>
      <PageHeader title={t.admin.nav.plans} description={t.admin.plansEditor.hint} />
      <div className="grid gap-6 xl:grid-cols-2">
        {plans.map((p) => (
          <PlanEditor key={p.id} lang={lang} plan={{ id: p.id, code: p.code, name: p.name, priceMonthly: p.priceMonthly, orderPack: p.orderPack, isActive: p.isActive, limits: p.limits, features: p.features }} t={{ admin: t.admin, plans: t.plans, errors: t.errors, common: t.common }} />
        ))}
      </div>
    </>
  );
}
