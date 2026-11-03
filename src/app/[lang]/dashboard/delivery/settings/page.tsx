import { eq } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { DeliverySettingsForm } from "@/features/delivery/DeliverySettingsForm";
import { listRates } from "@/features/delivery/queries";
import { optionFromTable, resolveDelivery } from "@/features/delivery/settings";

// Delivery → General settings (Zimam): delivery on/off and the delivery methods, each with its own prices
export default async function DeliverySettingsPage({ params }: PageProps<"/[lang]/dashboard/delivery/settings">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "deliverySettings");
  const [table, [row]] = await Promise.all([listRates(shop.id), db.select({ delivery: schema.shops.delivery }).from(schema.shops).where(eq(schema.shops.id, shop.id))]);
  const settings = resolveDelivery(row?.delivery);
  // An older store priced from the shared wilaya table: shown as one method to save
  const legacy = !settings.options.length && Object.keys(table).length ? optionFromTable(table) : null;
  return (
    <DeliverySettingsForm
      lang={lang}
      initial={settings}
      legacy={legacy}
      wilayas={wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }))}
      t={{ delivery: t.delivery, errors: t.errors, common: t.common }}
    />
  );
}
