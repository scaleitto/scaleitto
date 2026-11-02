import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { pixelPlatforms, type PixelPlatform } from "@/server/db/schema";
import { Badge, Card } from "@/ui";
import { productChoices } from "@/features/landing/queries";
import { listPixels, recentPixelEvents } from "@/features/pixels/queries";
import { serverPlatforms } from "@/features/pixels/ids";
import { PixelApp } from "@/features/pixels/PixelApp";
import { PlatformMark } from "@/features/pixels/PlatformMark";

// One platform's page (Zimam: "Open app"): back link, what it is, its form, and the server log
export default async function PixelAppPage({ params }: PageProps<"/[lang]/dashboard/integrations/pixels/[platform]">) {
  const { lang: rawLang, platform: raw } = await params;
  const lang = asLocale(rawLang);
  if (!(pixelPlatforms as readonly string[]).includes(raw)) notFound();
  const platform = raw as PixelPlatform;
  const t = getDictionary(lang);
  const px = t.pixels;
  const { shop } = await requireSection(lang, "pixels");
  const hasServer = serverPlatforms.includes(platform);
  const [pixels, products, events] = await Promise.all([listPixels(shop.id, platform), productChoices(shop.id), hasServer ? recentPixelEvents(shop.id, platform) : Promise.resolve([])]);
  const app = px.apps[platform];
  return (
    <div className="max-w-4xl space-y-6" data-pixel-page={platform}>
      <Link href={sectionHref(lang, "pixels")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-panel px-4 text-sm font-medium shadow-sm hover:bg-panel-2">
        <ChevronLeft size={17} className="rtl:rotate-180" /> {px.back}
      </Link>
      <div className="flex gap-4 rounded-2xl border border-info/25 bg-info/5 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info/10 text-info">
          <Info size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-semibold text-info">
            <PlatformMark platform={platform} size={20} /> {app.title}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-info/90">{app.about}</p>
        </div>
      </div>
      <PixelApp lang={lang} platform={platform} pixels={pixels} products={products.map((p) => ({ id: p.id, name: p.name }))} t={{ pixels: px, errors: t.errors, common: t.common }} />

      {hasServer && (
        <Card className="overflow-x-auto p-0" data-testid="pixel-log">
          <div className="p-5 pb-3">
            <h2 className="font-semibold">{px.logTitle}</h2>
            <p className="mt-0.5 text-xs text-muted">{px.logHint}</p>
          </div>
          {events.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">{px.logEmpty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {(["time", "pixel", "event", "order", "status", "detail"] as const).map((k) => (
                    <th key={k} className="text-start whitespace-nowrap">
                      {px.logColumns[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} data-event={ev.event} data-status={ev.status}>
                    <td className="whitespace-nowrap text-muted">
                      <bdi>{formatDate(new Date(ev.createdAt), lang)}</bdi>
                    </td>
                    <td>
                      <bdi dir="ltr">{ev.pixelName}</bdi>
                    </td>
                    <td>{px.logEvents[ev.event as keyof typeof px.logEvents] ?? ev.event}</td>
                    <td>{ev.orderNumber ? `#${ev.orderNumber}` : "—"}</td>
                    <td>
                      <Badge tone={ev.status === "sent" ? "accent" : ev.status === "failed" ? "danger" : "neutral"}>{px.logStatuses[ev.status]}</Badge>
                    </td>
                    <td className="max-w-xs truncate text-xs text-muted" dir="ltr" title={ev.detail ?? ""}>
                      {ev.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
