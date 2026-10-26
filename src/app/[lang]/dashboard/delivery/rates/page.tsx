import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { DeliveryHeader } from "@/features/delivery/DeliveryTabs";
import { RatesForm } from "@/features/delivery/RatesForm";
import { listRates } from "@/features/delivery/queries";
import { saveRates } from "@/features/delivery/actions";

export default async function RatesPage({ params }: PageProps<"/[lang]/dashboard/delivery/rates">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "delivery");
  return (
    <>
      <DeliveryHeader lang={lang} t={t} current="rates" />
      <RatesForm
        wilayas={wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }))}
        initial={await listRates(shop.id)}
        t={{ delivery: t.delivery, errors: t.errors, common: t.common }}
        action={saveRates.bind(null, lang)}
      />
    </>
  );
}
