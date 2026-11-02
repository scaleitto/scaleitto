import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { fmt } from "@/lib/format";
import { Card, PageHeader, buttonClass } from "@/ui";
import { pixelSummary } from "@/features/pixels/queries";
import { PlatformMark, gridOrder } from "@/features/pixels/PlatformMark";

// Zimam's "Pixels & Analytics": one card per platform (mark, active or not, what it does, "Open app")
export default async function PixelsPage({ params }: PageProps<"/[lang]/dashboard/integrations/pixels">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const px = t.pixels;
  const { shop } = await requireSection(lang, "pixels");
  const summary = await pixelSummary(shop.id);
  const base = sectionHref(lang, "pixels");
  return (
    <>
      <PageHeader title={px.title} description={px.subtitle} />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {gridOrder.map((p) => {
          const s = summary[p];
          const on = s.active > 0;
          return (
            <Card key={p} className="flex flex-col gap-5 p-6" data-pixel-app={p} data-state={on ? "on" : "off"}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-14 place-items-center rounded-xl border border-line bg-panel-2 shadow-sm">
                  <PlatformMark platform={p} />
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${on ? "border-accent/25 bg-accent-soft text-accent-ink" : "border-line bg-panel-2 text-muted"}`}>
                  <span className={`size-1.5 rounded-full ${on ? "bg-accent" : "bg-muted/60"}`} />
                  {on ? (s.active > 1 ? fmt(px.activeCount, { n: s.active }) : px.active) : px.inactive}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{px.apps[p].name}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{px.apps[p].card}</p>
              </div>
              <Link href={`${base}/${p}`} className={buttonClass("primary", "w-full")} data-testid="pixel-open">
                <ExternalLink size={15} /> {px.open}
              </Link>
            </Card>
          );
        })}
      </div>
    </>
  );
}
