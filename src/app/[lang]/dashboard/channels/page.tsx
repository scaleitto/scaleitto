import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/ui";
import { EcomanagerCard, SheetsCard } from "@/features/apps/AppCards";
import { appViews } from "@/features/apps/queries";
import { PlatformCard, SoonCard } from "@/features/channels/ChannelCards";
import { listChannels } from "@/features/channels/queries";

// Connected platforms (Zimam): Google Sheets (orders written to the sheet), Shopify and WooCommerce (their orders
// arrive here), the platforms not verified yet shown as coming
export default async function ChannelsPage({ params }: PageProps<"/[lang]/dashboard/channels">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "channels");
  const [apps, channels] = await Promise.all([appViews(shop.id), listChannels(shop.id)]);
  const text = { channels: t.channels, errors: t.errors };
  const appText = { apps: t.apps, errors: t.errors, common: t.common };
  return (
    <>
      <PageHeader title={t.sections.channels.title} description={t.sections.channels.description} />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6" data-channel="google_sheets">
          <SheetsCard lang={lang} view={apps.google_sheets} t={appText} />
          <EcomanagerCard sheets={apps.google_sheets} t={appText} />
        </div>
        <div className="space-y-6">
          {(["shopify", "woocommerce"] as const).map((kind) => {
            const view = channels.find((c) => c.kind === kind) ?? null;
            return <PlatformCard key={kind} lang={lang} kind={kind} view={view} lastOrder={view?.lastOrderAt ? formatDate(view.lastOrderAt, lang) : null} t={text} />;
          })}
        </div>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {["YouCan", "LightFunnels", "Orderdz", "Storeep"].map((name) => (
          <SoonCard key={name} name={name} t={text} />
        ))}
      </div>
    </>
  );
}
