import { eq } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { DeliverySettingsForm } from "@/features/delivery/DeliverySettingsForm";
import { RatesForm } from "@/features/delivery/RatesForm";
import { listRates } from "@/features/delivery/queries";
import { saveRates } from "@/features/delivery/actions";
import { resolveDelivery } from "@/features/delivery/settings";

// Delivery → general settings: delivery on/off, the options, the prices by wilaya
export default async function DeliverySettingsPage({ params }: PageProps<"/[lang]/dashboard/delivery/settings">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "deliverySettings");
  const [rates, [row]] = await Promise.all([listRates(shop.id), db.select({ delivery: schema.shops.delivery }).from(schema.shops).where(eq(schema.shops.id, shop.id))]);
  const text = { delivery: t.delivery, errors: t.errors, common: t.common };
  return (
    <>
      <div className="space-y-8">
        <DeliverySettingsForm lang={lang} initial={resolveDelivery(row?.delivery)} t={text} />
        <section className="space-y-3">
          <h2 className="font-semibold">{t.delivery.general.ratesTitle}</h2>
          <RatesForm wilayas={wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }))} initial={rates} t={text} action={saveRates.bind(null, lang)} />
        </section>
      </div>
    </>
  );
}
