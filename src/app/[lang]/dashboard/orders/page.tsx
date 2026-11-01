import { redirect } from "next/navigation";
import { asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { OrdersPage } from "@/features/orders/OrdersPage";

export default async function Orders({ params, searchParams }: PageProps<"/[lang]/dashboard/orders">) {
  const lang = asLocale((await params).lang);
  const sp = await searchParams;
  const { role } = await requireSection(lang, "orders");
  // Agents work in their portal (same filters)
  if (role === "agent") {
    const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    redirect(`/${lang}/call-center/orders${q.size ? `?${q}` : ""}`);
  }
  return <OrdersPage lang={lang} searchParams={sp} />;
}
