"use client";

import { useState, useTransition } from "react";
import { HandCoins, Plus, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { expenseCategories } from "@/lib/enums";
import { fmt } from "@/lib/format";
import { Button, Card, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { BatchReport, Progress, SelectionTools, selectedRows, useBatch, useSelectedCount } from "@/features/orders/OrderTools";
import { deleteExpense, markPaid } from "./actions";

type Text = Pick<Dictionary, "finance" | "orders" | "errors" | "delivery" | "common">;

// "Money received": marks the selected delivered orders as paid by the courier, one request each
export function PaidPanel({ lang, t }: { lang: string; t: Text }) {
  const f = t.finance;
  const count = useSelectedCount();
  const batch = useBatch(t);
  const [, startTransition] = useTransition();
  const ok = batch.results.filter((r) => r.ok).length;
  return (
    <div className="space-y-3" data-testid="paid-panel">
      <div className="flex flex-wrap items-center gap-3">
        <SelectionTools t={t} />
        <Button className="ms-auto" disabled={!count || Boolean(batch.running)} onClick={() => startTransition(() => batch.run(selectedRows(), (id) => markPaid(lang, id), () => f.paidDone))} data-testid="mark-paid">
          <HandCoins size={15} /> {fmt(f.markPaid, { n: count })}
        </Button>
      </div>
      {batch.running && <Progress done={batch.running.done} total={batch.running.total} label={fmt(f.marking, batch.running)} onStop={batch.stop} stopLabel={t.orders.ship.stop} />}
      {!batch.running && batch.results.length > 0 && <BatchReport results={batch.results} summary={fmt(f.paidReport, { ok, failed: batch.results.length - ok })} retryLabel="" onClose={() => batch.setResults([])} t={t} />}
    </div>
  );
}

export function ExpenseForm({ today, action, t }: { today: string; action: (s: ActionState, d: FormData) => Promise<ActionState>; t: Text }) {
  const f = t.finance;
  const e = t.errors as Record<string, string>;
  const [key, setKey] = useState(0);
  const { state, pending, onSubmit } = useActionForm(async (prev, fd) => {
    const r = await action(prev, fd);
    // A fresh, empty form for the next expense
    if (r.ok) setKey((k) => k + 1);
    return r;
  });
  return (
    <Card className="space-y-3">
      <h3 className="flex items-center gap-2 font-semibold">
        <Plus size={16} /> {f.addExpense}
      </h3>
      <form key={key} onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_10rem_9rem_1fr_auto] lg:items-end" data-testid="expense-form">
        <Field label={f.day} htmlFor="exp-day" error={fieldError(state, e, "day")}>
          <Input id="exp-day" name="day" type="date" dir="ltr" defaultValue={today} />
        </Field>
        <Field label={f.category} htmlFor="exp-category">
          <Select id="exp-category" name="category" defaultValue="ads">
            {expenseCategories.map((c) => (
              <option key={c} value={c}>
                {f.categories[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={f.amount} htmlFor="exp-amount" error={fieldError(state, e, "amount")}>
          <Input id="exp-amount" name="amount" inputMode="numeric" dir="ltr" />
        </Field>
        <Field label={f.note} htmlFor="exp-note">
          <Input id="exp-note" name="note" maxLength={200} />
        </Field>
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {t.common.save}
        </SubmitButton>
      </form>
      {state.error && state.error !== "checkFields" && <FormMessage state={state} errors={e} />}
    </Card>
  );
}

export function DeleteExpense({ lang, id, t }: { lang: string; id: string; t: Text }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={t.finance.remove}
      aria-label={t.finance.remove}
      onClick={() => confirm(t.finance.removeConfirm) && startTransition(async () => void (await deleteExpense(lang, id)))}
      className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
      data-testid="delete-expense"
    >
      <Trash2 size={15} />
    </button>
  );
}
