"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Button, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import type { ActionState } from "@/lib/action";

type Text = Pick<Dictionary, "inventory" | "errors" | "common">;
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Reason = "restock" | "adjust" | "damaged";

// "Adjust" on one stock line: restock, count, or write off, with the result shown before saving
export function AdjustStock({ line, action, t }: { line: { productId: string; variantId: string | null; name: string; stock: number }; action: Action; t: Text }) {
  const s = t.inventory;
  const e = t.errors as Record<string, string>;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("restock");
  const [quantity, setQuantity] = useState("");
  const { state, pending, onSubmit } = useActionForm(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) {
      setOpen(false);
      setQuantity("");
    }
    return r;
  });
  const q = Number(quantity);
  const after = !quantity || !Number.isInteger(q) || q < 0 ? null : reason === "restock" ? line.stock + q : reason === "damaged" ? Math.max(0, line.stock - q) : q;
  const label = { restock: s.quantityRestock, adjust: s.quantityAdjust, damaged: s.quantityDamaged }[reason];

  if (!open)
    return (
      <Button variant="ghost" className="relative z-10 px-2 py-1 text-xs" onClick={() => setOpen(true)} data-testid="adjust-stock">
        <SlidersHorizontal size={14} /> {s.adjust}
      </Button>
    );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={fmt(s.adjustTitle, { name: line.name })}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={t.common.cancel} onClick={() => setOpen(false)} />
      <form onSubmit={onSubmit} noValidate className="relative w-full max-w-md space-y-4 rounded-2xl bg-panel p-5 text-start shadow-2xl" data-testid="adjust-form">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">{fmt(s.adjustTitle, { name: line.name })}</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label={t.common.cancel} className="rounded-md p-1 text-muted hover:bg-panel-2">
            <X size={18} />
          </button>
        </div>
        <input type="hidden" name="productId" value={line.productId} />
        <input type="hidden" name="variantId" value={line.variantId ?? ""} />
        <FormMessage state={state} errors={e} />
        <Field label={s.reason} htmlFor="adjust-reason">
          <Select id="adjust-reason" name="reason" value={reason} onChange={(ev) => setReason(ev.target.value as Reason)}>
            {(["restock", "adjust", "damaged"] as const).map((r) => (
              <option key={r} value={r}>
                {s.reasons[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={label} htmlFor="adjust-quantity" error={fieldError(state, e, "quantity")} hint={fmt(s.current, { n: line.stock })}>
          <Input id="adjust-quantity" name="quantity" inputMode="numeric" dir="ltr" value={quantity} onChange={(ev) => setQuantity(ev.target.value.replace(/[^\d]/g, ""))} autoFocus />
        </Field>
        <Field label={s.note} htmlFor="adjust-note">
          <Input id="adjust-note" name="note" maxLength={200} />
        </Field>
        {after !== null && (
          <Alert variant="info">
            <span data-testid="adjust-after">{fmt(s.after, { n: after })}</span>
          </Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {t.common.cancel}
          </Button>
          <SubmitButton pending={pending} pendingText={t.common.loading}>
            {t.common.save}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function LowStockForm({ value, action, t }: { value: number; action: Action; t: Text }) {
  const s = t.inventory;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-2" data-testid="low-stock-form">
      <div className="w-32">
        <Field label={s.lowStock} htmlFor="lowStock" error={fieldError(state, e, "lowStock")}>
          <Input id="lowStock" name="lowStock" inputMode="numeric" dir="ltr" defaultValue={value} />
        </Field>
      </div>
      <SubmitButton pending={pending} variant="secondary" pendingText={t.common.loading}>
        {t.common.save}
      </SubmitButton>
      <p className="basis-full text-xs text-muted">{s.lowStockHint}</p>
    </form>
  );
}
