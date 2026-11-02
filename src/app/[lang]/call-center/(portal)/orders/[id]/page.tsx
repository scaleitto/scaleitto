import { redirect } from "next/navigation";
import { asLocale } from "@/i18n";
import { agentHome, requireAgent } from "@/server/auth/context";

// An order opens in the edit dialog over the list (Zimam's)
export default async function PortalOrder({ params }: PageProps<"/[lang]/call-center/orders/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  await requireAgent(lang);
  redirect(`${agentHome(lang)}/orders?edit=${encodeURIComponent(id)}`);
}
