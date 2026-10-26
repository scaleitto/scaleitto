import Link from "next/link";
import { CircleCheck, Package, Palette, ScanLine, Truck } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { Card, PageHeader } from "@/ui";

export default async function OverviewPage({ params }: PageProps<"/[lang]/dashboard">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { user } = await requireSection(lang, "overview");
  const steps = [
    { key: "products", icon: Package, label: t.overview.steps.products },
    { key: "delivery", icon: Truck, label: t.overview.steps.delivery },
    { key: "storeDesign", icon: Palette, label: t.overview.steps.design },
    { key: "pixels", icon: ScanLine, label: t.overview.steps.pixels },
  ] as const;
  return (
    <>
      <PageHeader title={`${t.overview.welcome} ${user.name}`} description={t.overview.subtitle} />
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <CircleCheck size={18} className="text-accent" /> {t.overview.getStarted}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map(({ key, icon: Icon, label }) => (
            <Link key={key} href={sectionHref(lang, key)} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 p-4 text-sm font-medium transition hover:border-accent">
              <Icon size={18} className="text-accent" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
