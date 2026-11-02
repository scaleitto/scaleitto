import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { SheetsCard } from "@/features/apps/AppCards";
import { appViews } from "@/features/apps/queries";
import { PlatformCard } from "@/features/channels/ChannelCards";
import { channelPages, type ChannelPage } from "@/features/channels/ChannelGrid";
import { listChannels } from "@/features/channels/queries";

const names: Record<ChannelPage, string> = { google_sheets: "Google Sheets", shopify: "Shopify", woocommerce: "WooCommerce" };

// One connected platform's setup page (Zimam: the card's "Connect" opens it)
export default async function ChannelPageView({ params }: PageProps<"/[lang]/dashboard/channels/[kind]">) {
  const { lang: rawLang, kind } = await params;
  const lang = asLocale(rawLang);
  if (!(channelPages as readonly string[]).includes(kind)) notFound();
  const page = kind as ChannelPage;
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "channels");
  const back = sectionHref(lang, "channels");
  let body;
  if (page === "google_sheets") {
    const apps = await appViews(shop.id);
    body = (
      <div data-channel="google_sheets">
        <SheetsCard lang={lang} view={apps.google_sheets} t={{ apps: t.apps, errors: t.errors, common: t.common }} />
      </div>
    );
  } else {
    const view = (await listChannels(shop.id)).find((c) => c.kind === page) ?? null;
    body = <PlatformCard lang={lang} kind={page} view={view} lastOrder={view?.lastOrderAt ? formatDate(view.lastOrderAt, lang) : null} t={{ channels: t.channels, errors: t.errors }} />;
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={back} className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-panel hover:bg-panel-2" title={t.common.back} aria-label={t.common.back}>
          <ArrowRight size={18} className="ltr:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{names[page]}</h1>
      </div>
      {body}
    </div>
  );
}
