"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { parcelKinds, stopDeskModes, type ParcelOptions } from "@/lib/enums";
import { Field, Input, Select } from "@/ui";

export type ParcelOptionsText = Pick<Dictionary, "delivery">;

// The parcel's options (the Packers / Ecotrack fields). `bulk` hides what belongs to one customer
// (second phone, map link, product wording) when the same options go to many orders at once.
export function ParcelOptionsFields({ value, onChange, idPrefix, bulk = false, defaultsOnly = false, t }: { value: ParcelOptions; onChange: (v: ParcelOptions) => void; idPrefix: string; bulk?: boolean; defaultsOnly?: boolean; t: ParcelOptionsText }) {
  const o = t.delivery.options;
  const [more, setMore] = useState(false);
  const set = <K extends keyof ParcelOptions>(key: K, v: ParcelOptions[K]) => onChange({ ...value, [key]: v });
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div className="space-y-3" data-testid="parcel-options">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={o.kind} htmlFor={id("kind")}>
          <Select id={id("kind")} value={value.kind} onChange={(e) => set("kind", e.target.value as ParcelOptions["kind"])}>
            {parcelKinds.map((k) => (
              <option key={k} value={k}>
                {o.kinds[k]}
              </option>
            ))}
          </Select>
        </Field>
        {!defaultsOnly && (
          <Field label={o.stopDesk} htmlFor={id("stopdesk")}>
            <Select id={id("stopdesk")} value={value.stopDesk} onChange={(e) => set("stopDesk", e.target.value as ParcelOptions["stopDesk"])}>
              {stopDeskModes.map((m) => (
                <option key={m} value={m}>
                  {o.stopDeskModes[m]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={o.weight} htmlFor={id("weight")}>
          <Input id={id("weight")} type="number" min={0} step="0.1" dir="ltr" value={value.weight ?? ""} onChange={(e) => set("weight", e.target.value === "" ? null : Number(e.target.value))} />
        </Field>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={value.fragile} onChange={(e) => set("fragile", e.target.checked)} className="size-4 accent-[var(--color-accent)]" data-testid="opt-fragile" />
        {o.fragile}
      </label>
      {value.kind === "exchange" && !defaultsOnly && (
        <Field label={o.itemToCollect} htmlFor={id("collect")}>
          <Input id={id("collect")} value={value.itemToCollect} maxLength={255} onChange={(e) => set("itemToCollect", e.target.value)} />
        </Field>
      )}
      <Field label={o.note} hint={o.noteHint} htmlFor={id("note")}>
        <Input id={id("note")} value={value.note} maxLength={255} onChange={(e) => set("note", e.target.value)} />
      </Field>
      {!bulk && !defaultsOnly && (
        <>
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-1 text-sm font-semibold text-accent">
            <ChevronDown size={15} className={more ? "rotate-180" : ""} /> {o.more}
          </button>
          {more && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={o.phone2} htmlFor={id("phone2")}>
                <Input id={id("phone2")} dir="ltr" inputMode="tel" value={value.phone2} maxLength={20} onChange={(e) => set("phone2", e.target.value)} />
              </Field>
              <Field label={o.mapLink} htmlFor={id("map")}>
                <Input id={id("map")} dir="ltr" value={value.mapLink} maxLength={500} onChange={(e) => set("mapLink", e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label={o.productLabel} hint={o.productLabelHint} htmlFor={id("product")}>
                  <Input id={id("product")} value={value.productLabel} maxLength={255} onChange={(e) => set("productLabel", e.target.value)} />
                </Field>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
