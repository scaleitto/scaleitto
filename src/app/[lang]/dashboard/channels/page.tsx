import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/ui";
import { appViews } from "@/features/apps/queries";
import { ChannelGrid, type ChannelTile } from "@/features/channels/ChannelGrid";
import { listChannels } from "@/features/channels/queries";

// Connected platforms (Zimam): one card per platform, in Zimam's order; each opens its own setup page
export default async function ChannelsPage({ params }: PageProps<"/[lang]/dashboard/channels">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "channels");
  const [apps, channels] = await Promise.all([appViews(shop.id), listChannels(shop.id)]);
  const platform = (kind: "shopify" | "woocommerce", name: string): ChannelTile => {
    const v = channels.find((c) => c.kind === kind);
    return { key: kind, name, page: kind, connected: Boolean(v), active: v?.active ?? false, orders: v?.ordersCount ?? 0, lastOrder: v?.lastOrderAt ? formatDate(v.lastOrderAt, lang) : null };
  };
  const soon = (name: string): ChannelTile => ({ key: name.toLowerCase(), name, page: null, connected: false, active: false, orders: 0, lastOrder: null });
  const sheets = apps.google_sheets;
  const tiles: ChannelTile[] = [
    { key: "google_sheets", name: "Google Sheets", page: "google_sheets", connected: Boolean(sheets), active: sheets?.active ?? false, orders: 0, lastOrder: null },
    soon("LightFunnels"),
    soon("Orderdz"),
    platform("shopify", "Shopify"),
    soon("Storeep"),
    platform("woocommerce", "WooCommerce"),
    soon("YouCan"),
  ];
  return (
    <>
      <PageHeader title={t.sections.channels.title} description={t.sections.channels.description} />
      <ChannelGrid base={sectionHref(lang, "channels")} tiles={tiles} t={t} />
    </>
  );
}
