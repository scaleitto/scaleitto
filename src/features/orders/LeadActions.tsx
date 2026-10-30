"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, MessageCircle, Phone, RotateCcw, ShoppingCart, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { Button, Field, Input, Select, inputClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { CommuneSelect } from "@/features/checkout/CommuneSelect";
import { whatsappLink } from "@/features/messages/templates";
import { convertLead, deleteLead, setLeadStatus } from "./actions";
import { fillRecovery, type RecoveryStep } from "./recovery";

type Text = Pick<Dictionary, "orders" | "errors" | "common">;
const iconButton = "rounded-lg p-2 text-muted transition hover:bg-panel-2 hover:text-fg disabled:opacity-50";

// One abandoned cart's recovery tools: the suggested step first (call, WhatsApp message, offer, create the order),
// then the others. Sending a message marks the cart as contacted.
export function LeadActions({
  lang,
  lead,
  step,
  messages,
  wilayas,
  orderBase,
  t,
}: {
  lang: string;
  lead: { id: string; phone: string; name: string; wilayaCode: number | null; quantity: number; status: "abandoned" | "contacted" };
  step: RecoveryStep;
  // The recovery message (filled) and the offer message ({offer} still to fill)
  messages: { message: string; offer: string };
  wilayas: { code: number; name: string }[];
  orderBase: string;
  t: Text;
}) {
  const r = t.orders.recovery;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"offer" | "order" | null>(null);
  const [offer, setOffer] = useState("");
  const errors = t.errors as Record<string, string>;
  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const res = await fn();
      setError(res.ok ? null : (errors[res.error ?? "unexpected"] ?? errors.unexpected));
    });
  const contacted = lead.status === "contacted";
  const touch = () => {
    if (!contacted) run(() => setLeadStatus(lang, lead.id, "contacted"));
  };
  const primary = (s: RecoveryStep) => (s === step ? "border-accent bg-accent text-accent-fg hover:bg-accent/90" : "border-line text-fg hover:bg-panel-2");
  const action = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition";

  return (
    <div className="space-y-2" data-testid="lead-actions">
      <div className="flex flex-wrap items-center gap-1.5">
        <a href={`tel:${lead.phone}`} onClick={touch} className={`${action} ${primary("call")}`} data-step="call">
          <Phone size={14} /> {r.call}
        </a>
        <a href={whatsappLink(lead.phone, messages.message)} target="_blank" rel="noreferrer" onClick={touch} className={`${action} ${primary("message")}`} data-step="message">
          <MessageCircle size={14} /> {r.message}
        </a>
        <button type="button" onClick={() => setPanel(panel === "offer" ? null : "offer")} className={`${action} ${primary("offer")}`} data-step="offer">
          <Gift size={14} /> {r.offer}
        </button>
        <button type="button" onClick={() => setPanel(panel === "order" ? null : "order")} className={`${action} ${primary("order")}`} data-step="order">
          <ShoppingCart size={14} /> {r.order}
        </button>
        <span className="ms-auto flex items-center">
          <button
            type="button"
            className={iconButton}
            disabled={pending}
            title={contacted ? t.orders.markAbandoned : t.orders.markContacted}
            aria-label={contacted ? t.orders.markAbandoned : t.orders.markContacted}
            onClick={() => run(() => setLeadStatus(lang, lead.id, contacted ? "abandoned" : "contacted"))}
          >
            {contacted ? <RotateCcw size={15} /> : <Check size={15} />}
          </button>
          <button
            type="button"
            className={`${iconButton} hover:bg-danger/10 hover:text-danger`}
            disabled={pending}
            title={t.common.delete}
            aria-label={t.common.delete}
            onClick={() => {
              if (confirm(t.orders.confirmDeleteLead)) run(() => deleteLead(lang, lead.id));
            }}
          >
            <Trash2 size={15} />
          </button>
        </span>
      </div>
      {panel === "offer" && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-panel-2 p-2.5" data-testid="lead-offer">
          <div className="min-w-48 flex-1">
            <Field label={r.offerLabel} hint={r.offerHint}>
              <Input value={offer} maxLength={120} placeholder={r.offerPlaceholder} onChange={(e) => setOffer(e.target.value)} />
            </Field>
          </div>
          <a
            href={offer.trim() ? whatsappLink(lead.phone, fillRecovery(messages.offer, { offer: offer.trim() })) : undefined}
            aria-disabled={!offer.trim()}
            target="_blank"
            rel="noreferrer"
            onClick={touch}
            className={`${action} border-accent bg-accent text-accent-fg ${offer.trim() ? "" : "pointer-events-none opacity-50"}`}
            data-testid="send-offer"
          >
            <MessageCircle size={14} /> {r.sendOffer}
          </a>
        </div>
      )}
      {panel === "order" && <ConvertForm lang={lang} lead={lead} wilayas={wilayas} orderBase={orderBase} onClose={() => setPanel(null)} t={t} />}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// The order taken on the phone: the cart's product and quantity, the address the customer gives
function ConvertForm({ lang, lead, wilayas, orderBase, onClose, t }: { lang: string; lead: { id: string; name: string; wilayaCode: number | null; quantity: number }; wilayas: { code: number; name: string }[]; orderBase: string; onClose: () => void; t: Text }) {
  const o = t.orders;
  const e = t.errors as Record<string, string>;
  const router = useRouter();
  const [wilaya, setWilaya] = useState<number | null>(lead.wilayaCode);
  const { state, pending, onSubmit } = useActionForm(async (prev, fd) => {
    const res = await convertLead(lang, lead.id, prev, fd);
    if (res.ok && res.message) router.push(`${orderBase}/${res.message}`);
    return res;
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-lg bg-panel-2 p-3" data-testid="lead-convert">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{o.recovery.orderTitle}</p>
        <button type="button" onClick={onClose} aria-label={t.common.cancel} className="rounded p-1 text-muted hover:bg-panel">
          <X size={15} />
        </button>
      </div>
      <FormMessage state={state} errors={e} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={o.name} error={fieldError(state, e, "name")}>
          <Input name="name" defaultValue={lead.name} />
        </Field>
        <Field label={o.recovery.quantity} error={fieldError(state, e, "quantity")}>
          <Input name="quantity" inputMode="numeric" dir="ltr" defaultValue={lead.quantity} />
        </Field>
        <Field label={o.wilaya} error={fieldError(state, e, "wilaya")}>
          <Select name="wilaya" value={wilaya ?? ""} onChange={(ev) => setWilaya(Number(ev.target.value) || null)}>
            <option value="">{o.wilaya}</option>
            {wilayas.map((w) => (
              <option key={w.code} value={w.code}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={o.commune} error={fieldError(state, e, "commune")}>
          <CommuneSelect key={wilaya} wilaya={wilaya} arabic={t.common.arabicNames} className={inputClass} placeholder={o.commune} choose={o.chooseCommune} chooseWilayaFirst={o.chooseWilayaFirst} />
        </Field>
        <Field label={o.deliveryType}>
          <Select name="deliveryType" defaultValue="home">
            <option value="home">{o.deliveryTypes.home}</option>
            <option value="office">{o.deliveryTypes.office}</option>
          </Select>
        </Field>
        <Field label={o.address}>
          <Input name="address" maxLength={255} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {o.recovery.create}
        </SubmitButton>
      </div>
    </form>
  );
}
