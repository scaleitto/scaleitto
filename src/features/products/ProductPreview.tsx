"use client";

import { ScanEye, Smartphone } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { descriptionHtml } from "@/lib/rich-text";
import type { ProductOption, QuantityOffer } from "@/server/db/schema";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import { Gallery } from "@/features/storefront/Gallery";
import { StoreFooter, StoreFrame, StoreHeader, TrustBadges, discountOf } from "@/features/storefront/blocks";
import type { ProductPreviewData } from "./editor-props";

export type PreviewProduct = {
  name: string;
  short: string;
  price: number;
  compareAtPrice: number | null;
  images: string[];
  description: string;
  descriptionImages: string[];
  trackStock: boolean;
  stock: number;
  options: ProductOption[];
  offers: QuantityOffer[];
  variants: { id: string; values: Record<string, string>; price: number | null; stock: number }[];
};

// Zimam's live preview: the product page exactly as the store draws it (the store's language, theme, color and order
// form), in a phone that scrolls. Nothing in it can be clicked.
export function ProductPreview({ data, product, storeName, labels }: { data: ProductPreviewData; product: PreviewProduct; storeName: string; labels: { title: string; mobile: string; tip: string; tipTitle: string; namePlaceholder: string } }) {
  const t = data.storeText;
  const cur = data.currency;
  const off = discountOf(product.price, product.compareAtPrice);
  return (
    <aside className="hidden space-y-3 xl:sticky xl:top-20 xl:block" data-testid="product-preview">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          <ScanEye size={15} /> {labels.title}
        </h2>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">{labels.mobile}</span>
      </div>
      <div className="mx-auto w-[340px] rounded-[2.6rem] bg-[#0b1220] p-2.5 shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-1.5 pb-2 text-[11px] font-semibold text-white" dir="ltr">
          <span>9:41</span>
          <span className="h-5 w-20 rounded-full bg-black" />
          <span className="flex items-end gap-0.5" aria-hidden>
            <span className="h-1.5 w-1 rounded-sm bg-white" />
            <span className="h-2 w-1 rounded-sm bg-white" />
            <span className="h-2.5 w-1 rounded-sm bg-white" />
            <span className="ms-1 h-2.5 w-5 rounded-sm border border-white" />
          </span>
        </div>
        <div className="h-[min(620px,calc(100vh-15rem))] overflow-y-auto overscroll-contain rounded-[2rem] bg-white [scrollbar-width:thin]" data-testid="preview-screen">
          <div inert>
            <StoreFrame locale={data.locale} color={data.color} theme={data.theme} className="min-h-full text-[13px]">
              <StoreHeader name={storeName} logoUrl={data.logoUrl} phone={null} whatsapp="" homeHref="#" align={data.theme.layout.header} t={t} />
              <div className="space-y-4 p-3">
                <Gallery images={product.images} alt={product.name} />
                <div className="space-y-1.5">
                  <h1 className="text-xl leading-snug font-extrabold" data-preview="name">
                    {product.name || labels.namePlaceholder}
                  </h1>
                  {product.short && (
                    <p className="text-s-muted" data-preview="short">
                      {product.short}
                    </p>
                  )}
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-brand-ink" data-preview="price">
                      {formatPrice(product.price, cur)}
                    </span>
                    {off > 0 && product.compareAtPrice ? (
                      <>
                        <span className="text-s-muted line-through">{formatPrice(product.compareAtPrice, cur)}</span>
                        <span dir="ltr" className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                          -{off}%
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <CheckoutForm
                  t={t}
                  currency={cur}
                  product={{ price: product.price, trackStock: product.trackStock, stock: product.stock, options: product.options, offers: product.offers }}
                  variants={product.variants}
                  rates={data.rates}
                  wilayas={[]}
                  action={async () => ({ ok: false })}
                  saveLead={async () => {}}
                  settings={{ ...data.form, appearance: "direct", stickyButton: false }}
                  embedded
                />
                <TrustBadges t={t} items={data.badges} />
                {(product.description || product.descriptionImages.length > 0) && (
                  <section className="space-y-3 rounded-[var(--s-radius)] border border-s-card-border bg-s-surface p-4 shadow-[var(--s-shadow)]">
                    <h2 className="font-bold">{t.description}</h2>
                    {product.description && <div className="rich-text leading-relaxed text-s-muted" data-preview="description" dangerouslySetInnerHTML={{ __html: descriptionHtml(product.description) }} />}
                    {product.descriptionImages.map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" className="w-full rounded-[var(--s-radius)] object-contain" />
                    ))}
                  </section>
                )}
              </div>
              <StoreFooter name={storeName} about={data.about} socials={data.socials} phone={data.phone} t={t} />
            </StoreFrame>
          </div>
        </div>
      </div>
      <div className="flex gap-3 rounded-xl border border-info/20 bg-info/5 p-3 text-xs text-info">
        <Smartphone size={18} className="shrink-0" />
        <p>
          <span className="mb-0.5 block font-semibold">{labels.tipTitle}</span>
          {labels.tip}
        </p>
      </div>
    </aside>
  );
}
