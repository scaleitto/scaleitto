import { connection } from "next/server";
import { getDictionary, asLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/server/auth/context";
import { PageHeader } from "@/ui";
import { fmt } from "@/lib/format";
import { PlanEditor } from "@/features/admin/AdminForms";
import { allPlans } from "@/features/admin/queries";

export default async function AdminPlans({ params }: PageProps<"/[lang]/admin/plans">) {
  const lang = asLocale((await params).lang);
  await requirePlatformAdmin(lang);
  await connection();
  const t = getDictionary(lang);
  const all = await allPlans();
  // The same plans as the merchants' subscription page (active ones); hidden older plans stay folded below
  const shown = all.filter((p) => p.isActive);
  const hidden = all.filter((p) => !p.isActive);
  const editor = (p: (typeof all)[number]) => (
    <PlanEditor key={p.id} lang={lang} plan={{ id: p.id, code: p.code, name: p.name, priceMonthly: p.priceMonthly, orderPack: p.orderPack, isActive: p.isActive, limits: p.limits, features: p.features }} t={{ admin: t.admin, plans: t.plans, errors: t.errors, common: t.common }} />
  );
  return (
    <>
      <PageHeader title={t.admin.nav.plans} description={t.admin.plansEditor.hint} />
      <div className="grid gap-6 xl:grid-cols-2" data-testid="admin-plans">
        {shown.map(editor)}
      </div>
      {hidden.length > 0 && (
        <details className="mt-8 rounded-xl border border-line bg-panel p-4" data-testid="hidden-plans">
          <summary className="cursor-pointer text-sm font-semibold text-muted">{fmt(t.admin.plansEditor.hiddenPlans, { n: hidden.length })}</summary>
          <p className="mt-2 text-xs text-muted">{t.admin.plansEditor.hiddenHint}</p>
          <div className="mt-4 grid gap-6 xl:grid-cols-2">{hidden.map(editor)}</div>
        </details>
      )}
    </>
  );
}
