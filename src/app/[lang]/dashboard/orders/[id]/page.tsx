import { redirect } from "next/navigation";
import { asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { OrderDetailPage } from "@/features/orders/OrderDetailPage";

export default async function OrderPage({ params }: PageProps<"/[lang]/dashboard/orders/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const { role } = await requireSection(lang, "orders");
  // Agents work in their portal
  if (role === "agent") redirect(`/${lang}/call-center/orders/${id}`);
  return <OrderDetailPage lang={lang} id={id} list={sectionHref(lang, "orders")} />;
}
