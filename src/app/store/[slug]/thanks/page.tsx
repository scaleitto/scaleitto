import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopBySlug, storeBase } from "@/lib/store";
import { getStoreDictionary } from "@/i18n/store";

export default async function ThanksPage({ params, searchParams }: PageProps<"/store/[slug]/thanks">) {
  const shop = await getShopBySlug((await params).slug);
  if (!shop) notFound();
  const { n } = await searchParams;
  const s = getStoreDictionary(shop.defaultLocale);
  const base = await storeBase(shop.slug);
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
      <h1 className="mt-5 text-2xl font-bold">{s.thanksTitle}</h1>
      <p className="mt-2 text-slate-600">{s.thanksBody}</p>
      {typeof n === "string" && /^\d+$/.test(n) && (
        <p className="mt-4 text-sm">
          {s.orderNumber}: <b>#{n}</b>
        </p>
      )}
      <Link href={base || "/"} className="btn mt-8">{s.backToStore}</Link>
    </div>
  );
}
