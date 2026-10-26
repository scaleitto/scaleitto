"use client";

import { useState, useTransition } from "react";
import type { StoreDictionary } from "@/i18n/store";
import { formatPrice } from "@/lib/format";
import type { UpsellState } from "../actions";

export function UpsellOffer({
  accept,
  s,
  currency,
  product,
}: {
  accept: () => Promise<UpsellState>;
  s: StoreDictionary;
  currency: string;
  product: { name: string; image: string | null; price: number; compareAt: number };
}) {
  const [state, setState] = useState<UpsellState>({});
  const [pending, startTransition] = useTransition();
  const money = (n: number) => formatPrice(n, currency);

  return (
    <div className="mt-8 rounded-2xl border-2 border-dashed border-brand bg-brand/5 p-5 text-start">
      <h2 className="text-center text-lg font-bold">{s.upsellTitle}</h2>
      <div className="mt-4 flex items-center gap-4">
        {product.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt="" className="h-20 w-20 rounded-lg object-cover" />
        )}
        <div>
          <div className="font-semibold">{product.name}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-brand">{money(product.price)}</span>
            {product.compareAt > product.price && <span className="text-sm text-slate-400 line-through">{money(product.compareAt)}</span>}
          </div>
        </div>
      </div>
      {state.added ? (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-center font-semibold text-green-700">
          {s.upsellAdded}
          {state.total != null && <span className="block text-sm font-normal">{s.newTotal}: {money(state.total)}</span>}
        </p>
      ) : state.error ? (
        <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm text-slate-600">{state.error === "stock" ? s.outOfStock : s.upsellExpired}</p>
      ) : (
        <button className="btn mt-4 w-full py-3" disabled={pending} onClick={() => startTransition(async () => setState(await accept()))}>
          {pending ? "…" : s.upsellAdd}
        </button>
      )}
    </div>
  );
}
