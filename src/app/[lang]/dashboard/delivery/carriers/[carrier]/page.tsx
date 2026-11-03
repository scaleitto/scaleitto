import { notFound } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { wilayaName, wilayas } from "@/lib/wilayas";
import { sectionHref } from "@/lib/permissions";
import { CarrierSetup } from "@/features/delivery/CarrierPanels";
import { findCarrier } from "@/features/delivery/carriers";
import { listCarrierAccounts } from "@/features/delivery/queries";

// Delivery → companies → one company (Zimam): its connection details and its parcel settings
export default async function CarrierPage({ params }: PageProps<"/[lang]/dashboard/delivery/carriers/[carrier]">) {
  const { lang: raw, carrier: key } = await params;
  const lang = asLocale(raw);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "delivery");
  const carrier = findCarrier(key);
  if (!carrier) notFound();
  const account = (await listCarrierAccounts(shop.id)).find((a) => a.carrier === carrier.key) ?? null;
  return (
    <CarrierSetup
      lang={lang}
      carrier={carrier}
      account={account}
      wilayas={wilayas.map((w) => ({ code: w.code, name: wilayaName(w.code, lang) }))}
      backHref={sectionHref(lang, "delivery")}
      t={{ delivery: t.delivery, errors: t.errors, common: t.common }}
    />
  );
}
