import { formatPrice } from "@/lib/format";

export function PriceTag({ price, compareAtPrice, currency }: { price: number; compareAtPrice: number | null; currency: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-3">
      <span className="text-3xl font-extrabold text-brand">{formatPrice(price, currency)}</span>
      {compareAtPrice && compareAtPrice > price ? <span className="text-xl text-s-muted line-through">{formatPrice(compareAtPrice, currency)}</span> : null}
    </p>
  );
}
