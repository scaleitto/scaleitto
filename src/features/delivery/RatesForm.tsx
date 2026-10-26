"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/action";
import { Button, Card, Input } from "@/ui";
import { FormMessage, SubmitButton, useActionForm } from "@/ui/form";
import type { DeliveryText } from "./CarrierPanels";

type Rates = Record<number, { home: string; office: string }>;

// Delivery price per wilaya (home / office), with quick "apply to all" tools.
export function RatesForm({ wilayas, initial, t, action }: { wilayas: { code: number; name: string }[]; initial: Record<number, { home: number | null; office: number | null }>; t: DeliveryText; action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const d = t.delivery;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  const [rates, setRates] = useState<Rates>(() =>
    Object.fromEntries(wilayas.map((w) => [w.code, { home: initial[w.code]?.home?.toString() ?? "", office: initial[w.code]?.office?.toString() ?? "" }])),
  );
  const [allHome, setAllHome] = useState("");
  const [allOffice, setAllOffice] = useState("");
  const set = (code: number, type: "home" | "office", value: string) => setRates((r) => ({ ...r, [code]: { ...r[code], [type]: value.replace(/[^\d]/g, "") } }));
  const applyAll = () =>
    setRates((r) => Object.fromEntries(Object.entries(r).map(([code, v]) => [code, { home: allHome || v.home, office: allOffice || v.office }])) as Rates);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-muted">{d.ratesHint}</p>
      <Card className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block text-muted">{d.home}</span>
          <Input aria-label={`${d.applyAll} ${d.home}`} inputMode="numeric" dir="ltr" className="w-32" value={allHome} onChange={(ev) => setAllHome(ev.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted">{d.office}</span>
          <Input aria-label={`${d.applyAll} ${d.office}`} inputMode="numeric" dir="ltr" className="w-32" value={allOffice} onChange={(ev) => setAllOffice(ev.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <Button type="button" variant="secondary" onClick={applyAll}>
          {d.applyAll}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setRates((r) => Object.fromEntries(Object.keys(r).map((c) => [c, { home: "", office: "" }])) as Rates)}>
          {d.clearAll}
        </Button>
      </Card>

      <FormMessage state={state} errors={e} success={t.common.saved} />

      <Card className="p-0">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-panel text-xs text-muted">
              <tr className="border-b border-line">
                <th className="p-3 text-start font-medium">{d.wilaya}</th>
                <th className="p-3 text-start font-medium">
                  {d.home} ({t.common.currency})
                </th>
                <th className="p-3 text-start font-medium">
                  {d.office} ({t.common.currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {wilayas.map((w) => (
                <tr key={w.code} className="border-b border-line last:border-0">
                  <td className="p-2 ps-3 whitespace-nowrap">{w.name}</td>
                  <td className="p-2">
                    <Input name={`home_${w.code}`} aria-label={`${d.home} ${w.name}`} inputMode="numeric" dir="ltr" className="max-w-32" value={rates[w.code].home} onChange={(ev) => set(w.code, "home", ev.target.value)} />
                  </td>
                  <td className="p-2">
                    <Input name={`office_${w.code}`} aria-label={`${d.office} ${w.name}`} inputMode="numeric" dir="ltr" className="max-w-32" value={rates[w.code].office} onChange={(ev) => set(w.code, "office", ev.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {t.common.save}
        </SubmitButton>
      </div>
    </form>
  );
}
