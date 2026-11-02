import { redirect } from "next/navigation";
import { asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";

// An order opens in the edit dialog over the list (Zimam's): old links land there
export default async function OrderPage({ params }: PageProps<"/[lang]/dashboard/orders/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const { role } = await requireSection(lang, "orders");
  if (role === "agent") redirect(`/${lang}/call-center/orders?edit=${encodeURIComponent(id)}`);
  redirect(`${sectionHref(lang, "orders")}?edit=${encodeURIComponent(id)}`);
}
