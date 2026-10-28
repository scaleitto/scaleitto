import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/ui";
import { EcomanagerCard, SheetsCard, WebhookCard } from "@/features/apps/AppCards";
import { ProductImport } from "@/features/apps/ProductImport";
import { appLog, appViews } from "@/features/apps/queries";
import { LOCKED, OLD_SCRIPT } from "@/features/apps/sync";
import { WhatsappCard } from "@/features/messages/WhatsappCard";
import { whatsappConfig } from "@/features/messages/whatsapp";

export default async function AppsPage({ params }: PageProps<"/[lang]/dashboard/apps">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const a = t.apps;
  const { shop } = await requireSection(lang, "apps");
  const [apps, log, whatsapp] = await Promise.all([appViews(shop.id), appLog(shop.id), whatsappConfig(shop.id)]);
  const text = { apps: a, errors: t.errors, common: t.common };
  const sheets = apps.google_sheets;
  return (
    <>
      <PageHeader title={t.sections.apps.title} description={t.sections.apps.description} />
      <div className="grid gap-6 xl:grid-cols-2">
        <SheetsCard lang={lang} view={sheets} t={text} />
        <div className="space-y-6">
          <EcomanagerCard sheets={sheets} t={text} />
          <WebhookCard lang={lang} view={apps.webhook} t={text} />
        </div>
      </div>
      <div className="mt-6">
        <WhatsappCard lang={lang} view={whatsapp ? { phoneNumberId: whatsapp.phoneNumberId, templates: whatsapp.templates } : null} kindLabels={t.assistant.messages.kinds} t={text} />
      </div>
      <div className="mt-6">
        <ProductImport lang={lang} t={text} />
      </div>
      <Card className="mt-6 overflow-x-auto p-0" data-testid="app-log">
        <h2 className="p-4 pb-2 font-semibold">{a.log.title}</h2>
        {log.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">{a.log.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                {(["time", "app", "kind", "order", "result", "detail"] as const).map((k) => (
                  <th key={k} className="p-3 text-start font-medium whitespace-nowrap">
                    {a.log.columns[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map((ev) => (
                <tr key={ev.id} className="border-b border-line last:border-0" data-app={ev.app} data-kind={ev.kind} data-ok={ev.ok ? "1" : "0"}>
                  <td className="p-3 whitespace-nowrap text-muted">
                    <bdi>{formatDate(new Date(ev.createdAt), lang)}</bdi>
                  </td>
                  <td className="p-3">{ev.app === "google_sheets" ? a.sheets.title : a.webhook.title}</td>
                  <td className="p-3">{a.log.kinds[ev.kind as keyof typeof a.log.kinds] ?? ev.kind}</td>
                  <td className="p-3">{ev.orderNumber ? `#${ev.orderNumber}` : "—"}</td>
                  <td className="p-3">
                    <Badge tone={ev.ok ? "accent" : "danger"}>{ev.ok ? a.log.ok : a.log.failed}</Badge>
                  </td>
                  <td className="max-w-sm p-3 text-xs break-words text-muted" dir="auto">
                    {ev.detail === LOCKED ? a.log.locked : ev.detail === OLD_SCRIPT ? t.errors.sheetsOldScript : ev.detail}
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
