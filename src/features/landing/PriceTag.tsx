import { formatPrice } from "@/lib/format";

export function PriceTag({ price, compareAtPrice, currency }: { price: number; compareAtPrice: number | null; currency: string }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
      <span className="text-3xl font-extrabold text-brand">{formatPrice(price, currency)}</span>
      {compareAtPrice && compareAtPrice > price ? (
        <>
          <span className="text-xl text-s-muted line-through">{formatPrice(compareAtPrice, currency)}</span>
          {/* Computed from the real prices */}
          <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-sm font-bold text-white" dir="ltr">
            -{Math.round((1 - price / compareAtPrice) * 100)}%
          </span>
        </>
      ) : null}
    </p>
  );
}
