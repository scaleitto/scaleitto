import { eq } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { DeliveryHeader } from "@/features/delivery/DeliveryTabs";
import { CarrierCatalog, ConnectedAccounts } from "@/features/delivery/CarrierPanels";
import { AutoSendSwitch } from "@/features/delivery/DeliverySettingsForm";
import { listCarrierAccounts } from "@/features/delivery/queries";
import { resolveDelivery } from "@/features/delivery/settings";

// Delivery → companies: send confirmed orders automatically, the connected accounts, the catalog
export default async function DeliveryPage({ params }: PageProps<"/[lang]/dashboard/delivery">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "delivery");
  const [accounts, [row]] = await Promise.all([listCarrierAccounts(shop.id), db.select({ delivery: schema.shops.delivery }).from(schema.shops).where(eq(schema.shops.id, shop.id))]);
  const text = { delivery: t.delivery, errors: t.errors, common: t.common };
  const names = wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }));
  return (
    <>
      <DeliveryHeader t={t} />
      <AutoSendSwitch lang={lang} initial={resolveDelivery(row?.delivery).autoSend} t={text} />
      <section className="mt-8 space-y-3">
        <h2 className="font-semibold">{t.delivery.connectedTitle}</h2>
        <ConnectedAccounts lang={lang} accounts={accounts} wilayaNames={Object.fromEntries(names.map((w) => [w.code, w.name]))} t={text} />
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="font-semibold">{t.delivery.available}</h2>
        <CarrierCatalog lang={lang} connected={accounts.map((a) => a.carrier)} wilayas={names} t={text} />
      </section>
    </>
  );
}
