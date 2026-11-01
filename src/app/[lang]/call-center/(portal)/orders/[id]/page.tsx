import { asLocale } from "@/i18n";
import { agentHome, requireAgent } from "@/server/auth/context";
import { OrderDetailPage } from "@/features/orders/OrderDetailPage";

export default async function PortalOrder({ params }: PageProps<"/[lang]/call-center/orders/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  await requireAgent(lang);
  return <OrderDetailPage lang={lang} id={id} list={`${agentHome(lang)}/orders`} />;
}
