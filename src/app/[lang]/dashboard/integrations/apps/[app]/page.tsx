import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ChevronLeft, ScanLine } from "lucide-react";
import { getDictionary, asLocale } from "@/i18n";
import { getStoreText } from "@/i18n/store";
import { isLocale } from "@/i18n/config";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { sectionHref } from "@/lib/permissions";
import { storeUrl } from "@/lib/urls";
import { formatDate } from "@/lib/format";
import { RulesApp } from "@/features/apps/RulesApp";
import { listCarrierAccounts } from "@/features/delivery/queries";
import { findCarrier } from "@/features/delivery/carriers";
import { wilayas } from "@/lib/wilayas";
import { PromotionsApp } from "@/features/promotions/PromotionsApp";
import { CollectionsApp } from "@/features/collections/CollectionsApp";
import { listCollections } from "@/features/collections/queries";
import { listPromotions, promotionProducts } from "@/features/promotions/queries";
import { toAlgeriaLocal } from "@/features/promotions/pricing";
import { Badge, Card, buttonClass } from "@/ui";
import { WebhookCard } from "@/features/apps/AppCards";
import { ProductImport } from "@/features/apps/ProductImport";
import { appLog, appViews } from "@/features/apps/queries";
import { LOCKED, OLD_SCRIPT } from "@/features/apps/sync";
import { appKeys, readyApps, type AppPageKey } from "@/features/apps/registry";
import { appsContext, blockedPhoneList, qrProducts } from "@/features/apps/settings-queries";
import { AssignModeForm, BlacklistApp, HowItWorks, OrderGuardForm, QrCodeApp, QuickContactForm, SwitchApp, ThankYouForm, TrackingForm, TrustBadgesForm } from "@/features/apps/AppPages";

// One app's page (Zimam: "Open app"): back link, what it does, its settings
export default async function AppPage({ params }: PageProps<"/[lang]/dashboard/integrations/apps/[app]">) {
  const { lang: rawLang, app: raw } = await params;
  const lang = asLocale(rawLang);
  if (!(appKeys as readonly string[]).includes(raw) || !readyApps.includes(raw as AppPageKey)) notFound();
  const app = raw as AppPageKey;
  const t = getDictionary(lang);
  const a = t.apps;
  const { shop } = await requireSection(lang, "apps");
  const ctx = await appsContext(shop.id);
  const text = { apps: a, errors: t.errors, common: t.common };
  const card = a.cards[app];
  const page = a.pages[app as keyof typeof a.pages];
  const storeText = getStoreText(isLocale(shop.defaultLocale) ? shop.defaultLocale : "ar");

  const wilayaOptions = wilayas.map((w) => ({ code: w.code, name: `${String(w.code).padStart(2, "0")} - ${lang === "ar" ? w.ar : w.fr}` }));
  let body: React.ReactNode;
  switch (app) {
    case "abandoned":
      body = <SwitchApp lang={lang} app="abandoned" enabled={ctx.apps.abandoned} label={a.pages.abandoned.enable} hint={a.pages.abandoned.enableHint} t={text} />;
      break;
    case "customFields":
      body = <SwitchApp lang={lang} app="customFields" enabled={ctx.apps.customFields} label={a.pages.customFields.enable} hint={a.pages.customFields.enableHint} t={text} />;
      break;
    case "parcelScanner":
      body = (
        <SwitchApp lang={lang} app="scanner" enabled={ctx.apps.scanner} label={a.pages.parcelScanner.enable} hint={a.pages.parcelScanner.enableHint} t={text}>
          {ctx.apps.scanner && (
            <Link href={sectionHref(lang, "scan")} className={buttonClass("secondary")}>
              <ScanLine size={15} /> {a.pages.parcelScanner.open}
            </Link>
          )}
        </SwitchApp>
      );
      break;
    case "fakeGuard":
      body = <OrderGuardForm lang={lang} settings={ctx.protection} t={text} />;
      break;
    case "agentAssign": {
      const [agents, products] = await Promise.all([
        db
          .select({ id: schema.shopMembers.userId, name: schema.users.name, active: schema.shopMembers.active })
          .from(schema.shopMembers)
          .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
          .where(and(eq(schema.shopMembers.shopId, shop.id), eq(schema.shopMembers.role, "agent"))),
        db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(eq(schema.products.shopId, shop.id)).orderBy(desc(schema.products.createdAt)).limit(300),
      ]);
      body = (
        <>
          <AssignModeForm lang={lang} mode={ctx.assignMode} agents={agents.filter((x) => x.active).length} teamHref={sectionHref(lang, "callCenters")} t={text} />
          <RulesApp lang={lang} kind="agent" rules={ctx.apps.agentRules} agents={agents.map((x) => ({ id: x.id, name: x.name }))} products={products} wilayas={wilayaOptions} t={text} />
        </>
      );
      break;
    }
    case "deliveryAssign": {
      const accounts = await listCarrierAccounts(shop.id);
      body = <RulesApp lang={lang} kind="delivery" rules={ctx.apps.deliveryRules} accounts={accounts.map((x) => ({ id: x.id, name: findCarrier(x.carrier)?.name ?? x.carrier }))} wilayas={wilayaOptions} t={text} />;
      break;
    }
    case "blacklist": {
      const phones = await blockedPhoneList(shop.id);
      body = <BlacklistApp lang={lang} phones={phones.map((p) => ({ phone: p.phone, reason: p.reason, at: formatDate(p.createdAt, lang) }))} ips={ctx.protection.blockedIps} t={text} />;
      break;
    }
    case "trustBadges":
      body = (
        <TrustBadgesForm
          lang={lang}
          badges={ctx.apps.badges}
          defaults={{
            payment: { title: storeText.cod, text: storeText.codHint },
            returns: { title: storeText.badges.returns, text: storeText.badges.returnsHint },
            guarantee: { title: storeText.badges.guarantee, text: storeText.badges.guaranteeHint },
            delivery: { title: storeText.fastDelivery, text: storeText.deliveryHint },
          }}
          t={text}
        />
      );
      break;
    case "quickContact":
      body = <QuickContactForm lang={lang} contact={ctx.apps.contact} t={text} />;
      break;
    case "thankYou":
      body = <ThankYouForm lang={lang} thanks={ctx.apps.thanks} defaults={{ title: storeText.thanks.title, message: storeText.thanks.body, home: storeText.thanks.back, product: storeText.thanks.backProduct }} t={text} />;
      break;
    case "qrCode": {
      const products = await qrProducts(shop.id);
      body = <QrCodeApp storeUrl={storeUrl(shop)} products={products} t={text} />;
      break;
    }
    case "orderTracking":
      body = <TrackingForm lang={lang} tracking={ctx.apps.tracking} pageHref={`${storeUrl(shop)}/track`} t={text} />;
      break;
    case "promotions": {
      const [list, products] = await Promise.all([listPromotions(shop.id), promotionProducts(shop.id)]);
      const names = new Map(products.map((p) => [p.id, p.name]));
      const now = Date.now();
      body = (
        <PromotionsApp
          lang={lang}
          products={products.map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.images[0] ?? null, draft: p.status !== "active" }))}
          campaigns={list.map((c) => ({ id: c.id, name: c.name, percent: c.percent, starts: formatDate(c.startsAt, lang), ends: formatDate(c.endsAt, lang), state: c.endsAt.getTime() <= now ? "ended" : c.startsAt.getTime() > now ? "scheduled" : "running", products: c.productIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n)) }))}
          defaults={{ start: toAlgeriaLocal(new Date(now)), end: toAlgeriaLocal(new Date(now + 7 * 86400_000)) }}
          currency={t.common.currency}
          t={text}
        />
      );
      break;
    }
    case "collections": {
      const rows = await listCollections(shop.id);
      body = <CollectionsApp lang={lang} rows={rows} storeUrl={storeUrl(shop)} t={{ ...text, media: t.media }} />;
      break;
    }
    case "productImport":
      body = <ProductImport lang={lang} t={text} />;
      break;
    case "webhook": {
      const [apps, log] = await Promise.all([appViews(shop.id), appLog(shop.id)]);
      body = (
        <>
          <WebhookCard lang={lang} view={apps.webhook} t={text} />
          <Card className="overflow-x-auto p-0" data-testid="app-log">
            <h2 className="p-5 pb-3 font-semibold">{a.log.title}</h2>
            {log.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">{a.log.empty}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {(["time", "app", "kind", "order", "result", "detail"] as const).map((k) => (
                      <th key={k} className="text-start whitespace-nowrap">
                        {a.log.columns[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {log.map((ev) => (
                    <tr key={ev.id} data-app={ev.app} data-kind={ev.kind} data-ok={ev.ok ? "1" : "0"}>
                      <td className="whitespace-nowrap text-muted">
                        <bdi>{formatDate(new Date(ev.createdAt), lang)}</bdi>
                      </td>
                      <td>{ev.app === "google_sheets" ? a.sheets.title : a.webhook.title}</td>
                      <td>{a.log.kinds[ev.kind as keyof typeof a.log.kinds] ?? ev.kind}</td>
                      <td>{ev.orderNumber ? `#${ev.orderNumber}` : "—"}</td>
                      <td>
                        <Badge tone={ev.ok ? "accent" : "danger"}>{ev.ok ? a.log.ok : a.log.failed}</Badge>
                      </td>
                      <td className="max-w-sm text-xs break-words text-muted" dir="auto">
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
      break;
    }
    default:
      notFound();
  }

  return (
    <div className="max-w-5xl space-y-6" data-app-page={app}>
      <Link href={sectionHref(lang, "apps")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-panel px-4 text-sm font-medium shadow-sm hover:bg-panel-2">
        <ChevronLeft size={17} className="rtl:rotate-180" /> {a.back}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-1 text-sm text-muted">{card.card}</p>
      </div>
      <HowItWorks title={a.howItWorks}>{page.about}</HowItWorks>
      {body}
    </div>
  );
}
