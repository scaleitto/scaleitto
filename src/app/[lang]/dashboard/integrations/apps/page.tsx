import Link from "next/link";
import { ExternalLink, Settings } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { Card, PageHeader, buttonClass } from "@/ui";
import { appIcons, appKeys, readyApps } from "@/features/apps/registry";
import { appStates } from "@/features/apps/settings-queries";

// Zimam's "Apps & Integrations": one card per app (icon, active or not, what it does, "Open app"); apps not built yet
// are shown as coming.
export default async function AppsPage({ params }: PageProps<"/[lang]/dashboard/integrations/apps">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const g = t.apps.grid;
  const { shop } = await requireSection(lang, "apps");
  const states = await appStates(shop.id);
  const base = sectionHref(lang, "apps");
  return (
    <>
      <PageHeader title={g.title} description={g.subtitle} />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {appKeys.map((key) => {
          const Icon = appIcons[key];
          const ready = readyApps.includes(key);
          const state = states[key];
          return (
            <Card key={key} className={`flex flex-col gap-5 p-6 ${ready ? "" : "opacity-75"}`} data-app-card={key} data-state={!ready ? "soon" : state === undefined || state === null ? "none" : state ? "on" : "off"}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-14 place-items-center rounded-xl border border-line bg-panel-2 text-accent shadow-sm">
                  <Icon size={26} strokeWidth={1.8} />
                </span>
                {!ready ? (
                  <span className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[11px] font-bold tracking-wide text-muted uppercase">{g.soon}</span>
                ) : (
                  typeof state === "boolean" && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${state ? "border-accent/25 bg-accent-soft text-accent-ink" : "border-line bg-panel-2 text-muted"}`}>
                      <span className={`size-1.5 rounded-full ${state ? "bg-accent" : "bg-muted/60"}`} />
                      {state ? g.active : g.inactive}
                    </span>
                  )
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-lg leading-snug font-bold">{t.apps.cards[key].name}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.apps.cards[key].card}</p>
              </div>
              {ready ? (
                <Link href={`${base}/${key}`} className={buttonClass("primary", "w-full")} data-testid="app-open">
                  {key === "fakeGuard" ? <Settings size={15} /> : <ExternalLink size={15} />} {key === "fakeGuard" ? g.configure : g.open}
                </Link>
              ) : (
                <span className={buttonClass("secondary", "w-full cursor-not-allowed")} aria-disabled>
                  {g.soonButton}
                </span>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
