"use client";

import { useMemo, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ProductOption, QuantityOffer } from "@/db/schema";
import { ImageManager } from "@/components/dashboard/ImageManager";

type Variant = {
  optionValues: Record<string, string>;
  title: string;
  sku: string;
  price: number | null;
  stock: number;
};

export type ProductFormValues = {
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  sku: string;
  stock: number;
  trackStock: boolean;
  status: "active" | "draft";
  images: string[];
  options: ProductOption[];
  variants: Variant[];
  offers: QuantityOffer[];
  upsellProductId: string | null;
  upsellPrice: number | null;
};

// Every combination of option values, e.g. [S,M] × [Red,Blue] → 4 variants
function combinations(options: { name: string; values: string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v }))),
    [{}],
  );
}

export function ProductForm({
  t,
  action,
  initial,
  otherProducts,
}: {
  t: Dictionary;
  action: (formData: FormData) => void;
  initial?: ProductFormValues;
  otherProducts: { id: string; name: string }[];
}) {
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [offers, setOffers] = useState<{ quantity: string; price: string; label: string }[]>(
    initial?.offers.map((o) => ({ quantity: String(o.quantity), price: String(o.price), label: o.label ?? "" })) ?? [],
  );
  const cleanOffers = offers
    .filter((o) => Number(o.quantity) >= 2 && o.price !== "")
    .map((o) => ({ quantity: Number(o.quantity), price: Number(o.price), label: o.label.trim() || undefined }));
  const [options, setOptions] = useState<{ name: string; values: string }[]>(
    initial?.options.map((o) => ({ name: o.name, values: o.values.join(", ") })) ?? [],
  );
  const [variantEdits, setVariantEdits] = useState<Record<string, Partial<Variant>>>(
    Object.fromEntries((initial?.variants ?? []).map((v) => [v.title, v])),
  );

  const parsedOptions = options
    .map((o) => ({ name: o.name.trim(), values: [...new Set(o.values.split(/[,،]/).map((v) => v.trim()).filter(Boolean))] }))
    .filter((o) => o.name && o.values.length);

  const variants: Variant[] = useMemo(() => {
    if (!parsedOptions.length) return [];
    return combinations(parsedOptions).map((optionValues) => {
      const title = Object.values(optionValues).join(" / ");
      const edit = variantEdits[title] ?? {};
      return { optionValues, title, sku: edit.sku ?? "", price: edit.price ?? null, stock: edit.stock ?? 0 };
    });
  }, [parsedOptions, variantEdits]);

  const editVariant = (title: string, patch: Partial<Variant>) =>
    setVariantEdits((prev) => ({ ...prev, [title]: { ...prev[title], ...patch } }));

  const p = t.products;
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="options" value={JSON.stringify(parsedOptions)} />
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
      <input type="hidden" name="offers" value={JSON.stringify(cleanOffers)} />

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">{p.name}</label>
          <input className="input" id="name" name="name" required defaultValue={initial?.name} />
        </div>
        <div>
          <label className="label" htmlFor="description">{p.description}</label>
          <textarea className="input min-h-32" id="description" name="description" defaultValue={initial?.description} />
        </div>
        <div>
          <span className="label">{p.images}</span>
          <ImageManager t={t} name="images" value={images} onChange={setImages} />
        </div>
      </div>

      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="price">{p.price} ({t.common.currency})</label>
          <input className="input" id="price" name="price" type="number" min={0} required defaultValue={initial?.price} />
        </div>
        <div>
          <label className="label" htmlFor="compareAtPrice">{p.compareAtPrice}</label>
          <input className="input" id="compareAtPrice" name="compareAtPrice" type="number" min={0} defaultValue={initial?.compareAtPrice ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="sku">{p.sku}</label>
          <input className="input" id="sku" name="sku" dir="ltr" defaultValue={initial?.sku} />
        </div>
        <div>
          <label className="label" htmlFor="stock">{p.stock}</label>
          <input className="input" id="stock" name="stock" type="number" min={0} defaultValue={initial?.stock ?? 0} disabled={variants.length > 0} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="trackStock" defaultChecked={initial?.trackStock ?? true} />
          {p.trackStock}
        </label>
        <div>
          <label className="label" htmlFor="status">{p.status}</label>
          <select className="input" id="status" name="status" defaultValue={initial?.status ?? "active"}>
            <option value="active">{p.active}</option>
            <option value="draft">{p.draft}</option>
          </select>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-bold">{p.options}</h2>
        {options.map((opt, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              className="input"
              placeholder={p.optionName}
              value={opt.name}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, name: e.target.value } : o)))}
            />
            <input
              className="input"
              placeholder={p.optionValues}
              value={opt.values}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, values: e.target.value } : o)))}
            />
            <button type="button" className="btn-danger" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
              {t.common.delete}
            </button>
          </div>
        ))}
        {options.length < 3 && (
          <button type="button" className="btn-outline" onClick={() => setOptions([...options, { name: "", values: "" }])}>
            + {p.addOption}
          </button>
        )}

        {variants.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{p.variant}</th>
                  <th>{p.price}</th>
                  <th>{p.sku}</th>
                  <th>{p.stock}</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.title}>
                    <td className="font-medium">{v.title}</td>
                    <td>
                      <input
                        className="input w-28"
                        type="number"
                        min={0}
                        placeholder="—"
                        value={v.price ?? ""}
                        onChange={(e) => editVariant(v.title, { price: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input className="input w-32" dir="ltr" value={v.sku} onChange={(e) => editVariant(v.title, { sku: e.target.value })} />
                    </td>
                    <td>
                      <input
                        className="input w-24"
                        type="number"
                        min={0}
                        value={v.stock}
                        onChange={(e) => editVariant(v.title, { stock: Number(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="font-bold">{p.offers}</h2>
          <p className="mt-1 text-sm text-slate-500">{p.offersHint}</p>
        </div>
        {offers.map((o, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[8rem_10rem_1fr_auto]">
            <input
              className="input"
              type="number"
              min={2}
              max={20}
              placeholder={p.offerQuantity}
              value={o.quantity}
              onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
            />
            <input
              className="input"
              type="number"
              min={0}
              placeholder={p.offerPrice}
              value={o.price}
              onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
            />
            <input
              className="input"
              placeholder={p.offerLabel}
              value={o.label}
              onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <button type="button" className="btn-danger" onClick={() => setOffers(offers.filter((_, j) => j !== i))}>
              {t.common.delete}
            </button>
          </div>
        ))}
        {offers.length < 5 && (
          <button type="button" className="btn-outline" onClick={() => setOffers([...offers, { quantity: String(offers.length + 2), price: "", label: "" }])}>
            + {p.addOffer}
          </button>
        )}
      </div>

      {otherProducts.length > 0 && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-bold">{p.upsell}</h2>
            <p className="mt-1 text-sm text-slate-500">{p.upsellHint}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="upsellProductId">{p.upsellProduct}</label>
              <select className="input" id="upsellProductId" name="upsellProductId" defaultValue={initial?.upsellProductId ?? ""}>
                <option value="">{t.common.none}</option>
                {otherProducts.map((op) => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="upsellPrice">{p.upsellPrice} ({t.common.currency})</label>
              <input className="input" id="upsellPrice" name="upsellPrice" type="number" min={0} defaultValue={initial?.upsellPrice ?? ""} />
            </div>
          </div>
        </div>
      )}

      <button className="btn">{t.common.save}</button>
    </form>
  );
}
