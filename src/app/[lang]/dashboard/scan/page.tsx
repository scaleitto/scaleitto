import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { ScanPanel } from "@/features/delivery/ScanPanel";

// Scan (Zimam's): parcels leave (dispatch) or come back (recuperate) by scanning their label
export default async function ScanPage({ params }: PageProps<"/[lang]/dashboard/scan">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  await requireSection(lang, "scan");
  return <ScanPanel lang={lang} t={t.orderPage} />;
}
