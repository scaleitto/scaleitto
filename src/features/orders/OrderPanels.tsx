"use client";

import { useState, useTransition } from "react";
import { Ban, MessageCircle, Pencil, Phone, ShieldCheck } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { changeOrderStatus, setPhoneBlocked } from "./actions";
import { orderStatuses, type OrderStatus } from "./statuses";

export type OrderText = Pick<Dictionary, "orders" | "errors" | "common">;
type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

// Runs a server action from a button and keeps its error message.
function useButtonAction(t: OrderText) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const errors = t.errors as Record<string, string>;
  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(errors[r.error ?? "unexpected"] ?? errors.unexpected);
    });
  return { pending, error, run };
}

const statusStyle: Partial<Record<OrderStatus, string>> = {
  confirmed: "border-accent/50 text-accent hover:bg-accent/10",
  delivered: "border-accent/50 text-accent hover:bg-accent/10",
  cancelled: "border-danger/40 text-danger hover:bg-danger/10",
  returned: "border-danger/40 text-danger hover:bg-danger/10",
};

export function StatusPicker({ lang, orderId, status, t }: { lang: string; orderId: string; status: OrderStatus; t: OrderText }) {
  const { pending, error, run } = useButtonAction(t);
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{t.orders.changeStatus}</h2>
      <div className="flex flex-wrap gap-2" data-testid="status-picker">
        {orderStatuses.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || s === status}
            aria-pressed={s === status}
            onClick={() => run(() => changeOrderStatus(lang, orderId, s))}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-default ${
              s === status ? "border-transparent bg-fg text-bg" : (statusStyle[s] ?? "border-line text-fg hover:bg-panel-2")
            } ${pending && s !== status ? "opacity-50" : ""}`}
          >
            {t.orders.statuses[s]}
          </button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
    </Card>
  );
}

type Customer = { customerName: string; phone: string; wilayaCode: number; commune: string; address: string | null; deliveryType: "home" | "office"; shippingPrice: number };

export function CustomerCard({ customer, wilayaLabel, wilayas, t, action }: { customer: Customer; wilayaLabel: string; wilayas: { code: number; name: string }[]; t: OrderText; action: FormAction }) {
  const o = t.orders;
  const [editing, setEditing] = useState(false);
  const { state, pending, onSubmit } = useActionForm(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.ok) setEditing(false);
    return result;
  });
  const e = t.errors as Record<string, string>;
  const intl = customer.phone.replace(/^0/, "213");

  if (!editing)
    return (
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{o.customer}</h2>
          <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(true)}>
            <Pencil size={15} /> {o.editCustomer}
          </Button>
        </div>
        {state.ok && <Alert variant="success">{t.common.saved}</Alert>}
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">{o.name}</dt>
            <dd className="font-semibold" data-testid="customer-name">
              {customer.customerName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{o.phone}</dt>
            <dd className="font-semibold" dir="ltr">
              {customer.phone}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{o.wilaya}</dt>
            <dd>{wilayaLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{o.commune}</dt>
            <dd>{customer.commune}</dd>
          </div>
          {customer.address && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">{o.address}</dt>
              <dd>{customer.address}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted">{o.deliveryType}</dt>
            <dd>{o.deliveryTypes[customer.deliveryType]}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg">
            <Phone size={15} /> {o.call}
          </a>
          <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-panel-2">
            <MessageCircle size={15} /> {o.whatsapp}
          </a>
        </div>
      </Card>
    );

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <h2 className="font-semibold">{o.editCustomer}</h2>
        <FormMessage state={state} errors={e} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={o.name} htmlFor="customerName" error={fieldError(state, e, "customerName")}>
            <Input id="customerName" name="customerName" defaultValue={customer.customerName} />
          </Field>
          <Field label={o.phone} htmlFor="phone" error={fieldError(state, e, "phone")}>
            <Input id="phone" name="phone" dir="ltr" defaultValue={customer.phone} />
          </Field>
          <Field label={o.wilaya} htmlFor="wilayaCode" error={fieldError(state, e, "wilayaCode")}>
            <Select id="wilayaCode" name="wilayaCode" defaultValue={customer.wilayaCode}>
              {wilayas.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={o.commune} htmlFor="commune" error={fieldError(state, e, "commune")}>
            <Input id="commune" name="commune" defaultValue={customer.commune} />
          </Field>
          <Field label={o.deliveryType} htmlFor="deliveryType">
            <Select id="deliveryType" name="deliveryType" defaultValue={customer.deliveryType}>
              <option value="home">{o.deliveryTypes.home}</option>
              <option value="office">{o.deliveryTypes.office}</option>
            </Select>
          </Field>
          <Field label={`${o.shippingPrice} (${t.common.currency})`} htmlFor="shippingPrice" error={fieldError(state, e, "shippingPrice")}>
            <Input id="shippingPrice" name="shippingPrice" inputMode="numeric" dir="ltr" defaultValue={customer.shippingPrice} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={o.address} htmlFor="address">
              <Input id="address" name="address" defaultValue={customer.address ?? ""} />
            </Field>
          </div>
        </div>
        <div className="flex gap-2">
          <SubmitButton pending={pending} pendingText={t.common.loading}>
            {t.common.save}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function PhoneBlockButton({ lang, phone, blocked, t }: { lang: string; phone: string; blocked: boolean; t: OrderText }) {
  const { pending, error, run } = useButtonAction(t);
  return (
    <div className="space-y-2">
      {blocked ? (
        <Button variant="secondary" disabled={pending} onClick={() => run(() => setPhoneBlocked(lang, phone, false))}>
          <ShieldCheck size={15} /> {t.orders.unblock}
        </Button>
      ) : (
        <Button
          variant="danger"
          className="px-0"
          disabled={pending}
          onClick={() => {
            if (confirm(t.orders.confirmBlock)) run(() => setPhoneBlocked(lang, phone, true));
          }}
        >
          <Ban size={15} /> {t.orders.block}
        </Button>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

export function NoteForm({ t, action }: { t: OrderText; action: FormAction }) {
  const [key, setKey] = useState(0);
  const { state, pending, onSubmit } = useActionForm(async (prev, fd) => {
    const result = await action(prev, fd);
    // A saved note clears the box (remounting the form gives an empty textarea).
    if (result.ok) setKey((k) => k + 1);
    return result;
  });
  const e = t.errors as Record<string, string>;
  return (
    <form key={key} onSubmit={onSubmit} noValidate className="space-y-2">
      <Textarea name="note" rows={2} placeholder={t.orders.notePlaceholder} aria-label={t.orders.addNote} />
      {fieldError(state, e, "note") && <p className="text-xs text-danger">{fieldError(state, e, "note")}</p>}
      <SubmitButton pending={pending} variant="secondary" pendingText={t.common.loading}>
        {t.orders.addNote}
      </SubmitButton>
    </form>
  );
}
