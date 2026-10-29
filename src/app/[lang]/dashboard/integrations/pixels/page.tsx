import { CircleCheck } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { Badge, Card, PageHeader } from "@/ui";
import { formatDate } from "@/lib/format";
import { productChoices } from "@/features/landing/queries";
import { listPixels, recentPixelEvents } from "@/features/pixels/queries";
import { PixelManager } from "@/features/pixels/PixelManager";

export default async function PixelsPage({ params }: PageProps<"/[lang]/dashboard/integrations/pixels">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const px = t.pixels;
  const { shop } = await requireSection(lang, "pixels");
  const [pixels, products, events] = await Promise.all([listPixels(shop.id), productChoices(shop.id), recentPixelEvents(shop.id)]);
  return (
    <>
      <PageHeader title={t.sections.pixels.title} description={t.sections.pixels.description} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <PixelManager lang={lang} pixels={pixels} products={products.map((p) => ({ id: p.id, name: p.name }))} t={{ pixels: px, errors: t.errors, common: t.common }} />
        <Card className="space-y-3 self-start">
          <h2 className="font-semibold">{px.eventsTitle}</h2>
          <ul className="space-y-2 text-sm text-muted">
            {px.eventsList.map((line) => (
              <li key={line} className="flex gap-2">
                <CircleCheck size={16} className="mt-0.5 shrink-0 text-accent" /> {line}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto p-0" data-testid="pixel-log">
        <h2 className="p-4 pb-2 font-semibold">{px.logTitle}</h2>
        {events.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">{px.logEmpty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                {(["time", "pixel", "event", "order", "status", "detail"] as const).map((k) => (
                  <th key={k} className="p-3 text-start font-medium whitespace-nowrap">
                    {px.logColumns[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-line last:border-0" data-event={ev.event} data-status={ev.status}>
                  <td className="p-3 whitespace-nowrap text-muted">
                    <bdi>{formatDate(new Date(ev.createdAt), lang)}</bdi>
                  </td>
                  <td className="p-3">{ev.pixelName}</td>
                  <td className="p-3">{px.logEvents[ev.event as keyof typeof px.logEvents] ?? ev.event}</td>
                  <td className="p-3">{ev.orderNumber ? `#${ev.orderNumber}` : "—"}</td>
                  <td className="p-3">
                    <Badge tone={ev.status === "sent" ? "accent" : ev.status === "failed" ? "danger" : "neutral"}>{px.logStatuses[ev.status]}</Badge>
                  </td>
                  <td className="max-w-xs truncate p-3 text-xs text-muted" dir="ltr" title={ev.detail ?? ""}>
                    {ev.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
