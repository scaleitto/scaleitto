import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopBySlug, storeBase } from "@/features/storefront/queries";
import { shopLocale } from "@/features/storefront/StoreShell";
import { getStoreText } from "@/i18n/store";
import { policyKinds, type PolicyKind } from "@/lib/enums";

async function load(params: PageProps<"/store/[slug]/policies/[kind]">["params"]) {
  const { slug, kind } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop || !policyKinds.includes(kind as PolicyKind)) notFound();
  const text = shop.policies?.[kind as PolicyKind];
  if (!text) notFound();
  return { shop, kind: kind as PolicyKind, text };
}

export async function generateMetadata({ params }: PageProps<"/store/[slug]/policies/[kind]">): Promise<Metadata> {
  const { shop, kind } = await load(params);
  return { title: getStoreText(shopLocale(shop)).policies[kind] };
}

// A policy page written by the merchant in the settings (plain text, line breaks kept)
export default async function PolicyPage({ params }: PageProps<"/store/[slug]/policies/[kind]">) {
  const { shop, kind, text } = await load(params);
  const t = getStoreText(shopLocale(shop));
  return (
    <article className="mx-auto max-w-3xl space-y-5 rounded-[var(--s-radius)] bg-s-surface p-6 shadow-[var(--s-shadow)] sm:p-10" data-testid="policy-page">
      <h1 className="text-2xl font-extrabold">{t.policies[kind]}</h1>
      <div className="leading-loose whitespace-pre-line text-s-muted" dir="auto">{text}</div>
      <Link href={(await storeBase(shop.slug)) || "/"} className="inline-block font-semibold text-brand-ink hover:underline">
        {t.backToStore}
      </Link>
    </article>
  );
}
