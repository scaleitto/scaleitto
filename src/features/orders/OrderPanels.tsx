"use client";

import { useState, useTransition } from "react";
import { Ban, MessageCircle, Pencil, Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { Alert, Button, Card, Field, Input, Select, Textarea, inputClass } from "@/ui";
import { CommuneSelect } from "@/features/checkout/CommuneSelect";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { assignOrder, changeOrderStatus, markOrderTrusted, setPhoneBlocked } from "./actions";
import { setFollowUp, type FollowUpField } from "./followup";
import { deliveryFaults, processingStates } from "@/server/db/schema";
import { fmt } from "@/lib/format";
import { ATTEMPT_STATUSES, MAX_CALLS, callStatuses, deliveryOrder, type orderModel } from "./statuses";

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

type Customer = { customerName: string; phone: string; wilayaCode: number; commune: string; address: string | null; deliveryType: "home" | "office"; shippingPrice: number };

export function CustomerCard({ customer, wilayaLabel, wilayas, t, action }: { customer: Customer; wilayaLabel: string; wilayas: { code: number; name: string }[]; t: OrderText; action: FormAction }) {
  const o = t.orders;
  const [editing, setEditing] = useState(false);
  const [wilaya, setWilaya] = useState(customer.wilayaCode);
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
            <Select id="wilayaCode" name="wilayaCode" value={wilaya} onChange={(ev) => setWilaya(Number(ev.target.value))}>
              {wilayas.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={o.commune} htmlFor="commune" error={fieldError(state, e, "commune")}>
            <CommuneSelect
              key={wilaya}
              wilaya={wilaya}
              arabic={t.common.arabicNames}
              defaultValue={wilaya === customer.wilayaCode ? customer.commune : ""}
              className={inputClass}
              placeholder={o.commune}
              choose={o.chooseCommune}
              chooseWilayaFirst={o.chooseWilayaFirst}
            />
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

// Who handles the order. Managers pick a member; agents just see it.
export function AssignCard({ lang, orderId, assignedTo, assigneeName, members, t }: { lang: string; orderId: string; assignedTo: string | null; assigneeName: string | null; members: { userId: string; name: string }[]; t: OrderText }) {
  const { pending, error, run } = useButtonAction(t);
  return (
    <Card className="space-y-3" data-testid="assign">
      <h2 className="font-semibold">{t.orders.assignee}</h2>
      {members.length ? (
        <Select
          aria-label={t.orders.assignee}
          value={assignedTo ?? ""}
          disabled={pending}
          onChange={(e) => {
            const value = e.target.value || null;
            run(() => assignOrder(lang, orderId, value));
          }}
        >
          <option value="">{t.orders.unassigned}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </Select>
      ) : (
        <p className="text-sm">{assigneeName ?? t.orders.unassigned}</p>
      )}
      {error && <Alert>{error}</Alert>}
    </Card>
  );
}

// The fake-order check of this order: its risk, why, and "this order is fine"
export function RiskCard({ lang, orderId, risk, reasons, threshold, held, t }: { lang: string; orderId: string; risk: number; reasons: string[]; threshold: number; held: boolean; t: OrderText }) {
  const r = t.orders.risk;
  const labels = r.reasons as Record<string, string>;
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const suspicious = risk >= threshold;
  return (
    <Card className={`space-y-3 ${suspicious ? "border-warning/40" : ""}`} data-testid="risk-card" data-risk={risk}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldAlert size={17} className={suspicious ? "text-warning" : "text-muted"} /> {r.title}
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${suspicious ? "bg-warning/10 text-warning" : "bg-panel-2 text-muted"}`}>{fmt(r.score, { n: risk })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className={`h-full rounded-full ${suspicious ? "bg-warning" : "bg-accent-bright"}`} style={{ width: `${Math.max(3, risk)}%` }} />
      </div>
      {reasons.length ? (
        <ul className="space-y-1 text-sm">
          {reasons.map((k) => (
            <li key={k} className="flex items-start gap-2" data-reason={k}>
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" /> {labels[k] ?? k}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{r.low}</p>
      )}
      {held && suspicious && <p className="text-xs font-semibold text-warning">{r.held}</p>}
      {risk > 0 &&
        (done ? (
          <p className="text-sm font-semibold text-[#047857]">{r.trustedDone}</p>
        ) : (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await markOrderTrusted(lang, orderId);
                setDone(Boolean(res.ok));
              })
            }
            data-testid="mark-trusted"
          >
            <ShieldCheck size={15} /> {r.markTrusted}
          </Button>
        ))}
    </Card>
  );
}

type Model = ReturnType<typeof orderModel>;

// The order's status in the owner's five sections, each a dropdown, in his order: 1 Statut de la commande, 2 Injection,
// 3 Livraison (+ 3.1 Remarque sur la livraison), 4 Traitement, 5 Livraison finale. The orders list shows the same sections
// with the same names. Calls are counted: 3 attempts at different times, then a message.
export function OrderStatusCard({
  lang,
  orderId,
  model,
  calls,
  t,
}: {
  lang: string;
  orderId: string;
  model: Model;
  // Calls made, per outcome, and how long ago the last one was (minutes)
  calls: { total: number; byStatus: Partial<Record<string, number>>; lastMinutes: number | null };
  t: OrderText;
}) {
  const o = t.orders;
  const f = o.followup;
  const m = o.model;
  const { pending, error, run } = useButtonAction(t);
  const sent = model.injection === "done";
  const call = (value: string) => run(() => changeOrderStatus(lang, orderId, value));
  const follow = (field: FollowUpField) => (value: string) => run(() => setFollowUp(lang, orderId, field, value));
  const attempt = (ATTEMPT_STATUSES as readonly string[]).includes(model.call);
  const select = (key: string, value: string | null, options: readonly string[], labels: Record<string, string>, onChange: (v: string) => void, opts: { disabled?: boolean; empty?: string; emptySelectable?: boolean } = {}) => (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={pending || opts.disabled}
      aria-label={m.titles[key as keyof typeof m.titles]}
      data-section={key}
      data-value={value ?? ""}
      className={`${inputClass} select-chevron appearance-none pe-9 py-2 text-sm disabled:opacity-60`}
    >
      {(opts.emptySelectable || !value) && (
        <option value="" disabled={!opts.emptySelectable}>
          {opts.empty ?? f.none}
        </option>
      )}
      {options.map((x) => (
        <option key={x} value={x}>
          {labels[x]}
        </option>
      ))}
    </select>
  );
  const row = (n: string, key: keyof typeof m.titles, control: React.ReactNode, note?: React.ReactNode) => (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center" data-row={key}>
      <span className={`text-sm font-semibold ${n.includes(".") ? "ps-4 text-muted" : ""}`}>{m.titles[key]}</span>
      <div className="space-y-1.5">
        {control}
        {note}
      </div>
    </div>
  );
  return (
    <Card className="space-y-1" data-testid="order-status">
      <h2 className="font-semibold">{m.title}</h2>
      <div className="divide-y divide-line">
        {row(
          "1",
          "call",
          select("call", model.call === "new" ? null : model.call, callStatuses.filter((x) => x !== "new"), o.statuses, call, { empty: o.statuses.new }),
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted" data-testid="call-attempts" data-calls={calls.total}>
            <span className="inline-flex items-center gap-1 font-semibold text-fg">
              <Phone size={13} /> {fmt(m.calls, { n: calls.total })}
            </span>
            {Object.entries(calls.byStatus).map(([k, n]) => (
              <span key={k}>
                {o.statuses[k as keyof typeof o.statuses]} ×{n}
              </span>
            ))}
            {calls.lastMinutes !== null && <span>{fmt(m.lastCall, { n: calls.lastMinutes })}</span>}
            {attempt && (
              <button type="button" disabled={pending} onClick={() => call(model.call)} className="font-semibold text-accent hover:underline disabled:opacity-50" data-testid="call-again">
                {fmt(m.again, { status: o.statuses[model.call] })}
              </button>
            )}
            {attempt && calls.total >= MAX_CALLS && <span className="basis-full rounded-md bg-warning/10 px-2 py-1 font-semibold text-warning" data-testid="send-message-hint">{m.sendMessage}</span>}
            {attempt && calls.total < MAX_CALLS && calls.lastMinutes !== null && calls.lastMinutes < 60 && <span className="basis-full text-warning">{m.laterTime}</span>}
          </div>,
        )}
        {row("2", "injection", select("injection", model.injection, ["pending", "done"], o.injection, follow("injection"), { disabled: !model.injection }), !model.injection && <p className="text-xs text-muted">{m.afterConfirm}</p>)}
        {row("3", "delivery", select("delivery", model.delivery, deliveryOrder, f.states, follow("state"), { disabled: !sent }))}
        {row("3.1", "fault", select("fault", model.fault, deliveryFaults, f.faults, follow("fault"), { disabled: !sent, emptySelectable: true }))}
        {row("4", "processing", select("processing", model.processing, processingStates, f.processingStates, follow("processing"), { disabled: !sent, emptySelectable: true }))}
        {row("5", "final", select("final", model.final, ["delivered", "returned"], f.states, follow("final"), { disabled: !sent, empty: f.finalPending }))}
      </div>
      {error && <Alert>{error}</Alert>}
    </Card>
  );
}
