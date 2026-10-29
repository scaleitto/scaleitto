"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ExternalLink, RefreshCw, Send, Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/action";
import type { ShipmentStatus } from "@/server/db/schema";
import { shipmentTone as tone } from "./status";
import { fmt } from "@/lib/format";
import { defaultParcelOptions, type ParcelDefaults } from "@/lib/enums";
import { ParcelOptionsFields } from "./ParcelOptions";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/ui";
import { SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { addManualShipment, refreshTracking, removeShipment, sendToCarrier } from "./actions";
import type { DeliveryText } from "./CarrierPanels";

type Shipment = { carrierName: string; trackingNumber: string; labelHref: string | null; status: ShipmentStatus; rawStatus: string | null; checkedAt: string | null; fromCarrier: boolean };
type Account = { id: string; name: string; isDefault: boolean; options: Partial<ParcelDefaults> | null };



function errorText(t: DeliveryText, r: ActionState) {
  const errors = t.errors as Record<string, string>;
  const base = errors[r.error ?? "unexpected"] ?? errors.unexpected;
  return r.message ? `${base}: ${r.message}` : base;
}

export function ShipmentCard({ lang, orderId, orderStatus, shipment, accounts, deliveryHref, t }: { lang: string; orderId: string; orderStatus: string; shipment: Shipment | null; accounts: Account[]; deliveryHref: string | null; t: DeliveryText }) {
  const d = t.delivery;
  const e = t.errors as Record<string, string>;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const firstAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
  const [accountId, setAccountId] = useState(firstAccount?.id ?? "");
  // The parcel options start from the chosen company's saved defaults
  const startOptions = (a?: Account) => ({ ...defaultParcelOptions, ...(a?.options ?? {}) });
  const [options, setOptions] = useState(() => startOptions(firstAccount));
  const [showOptions, setShowOptions] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualAccount, setManualAccount] = useState(firstAccount?.id ?? "");
  const manualForm = useActionForm(addManualShipment.bind(null, lang, orderId));
  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(errorText(t, r));
    });

  if (shipment)
    return (
      <Card className="space-y-3" data-testid="shipment">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{d.shipment}</h2>
          <Badge tone={tone[shipment.status]}>{d.statuses[shipment.status]}</Badge>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">{d.carrierName}</dt>
            <dd className="font-semibold">{shipment.carrierName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{d.trackingNumber}</dt>
            <dd className="font-semibold" dir="ltr" data-testid="tracking-number">
              {shipment.trackingNumber}
            </dd>
          </div>
          {shipment.rawStatus && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">{d.parcelStatus}</dt>
              <dd>{shipment.rawStatus}</dd>
            </div>
          )}
        </dl>
        {shipment.checkedAt && <p className="text-xs text-muted">{fmt(d.lastCheck, { date: shipment.checkedAt })}</p>}
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          {shipment.fromCarrier && (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => refreshTracking(lang, orderId))}>
              <RefreshCw size={15} className={pending ? "animate-spin" : ""} /> {d.refresh}
            </Button>
          )}
          {shipment.labelHref && (
            <a href={shipment.labelHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-panel-2" data-testid="label-link">
              <ExternalLink size={15} /> {d.label}
            </a>
          )}
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (confirm(d.confirmRemove)) run(() => removeShipment(lang, orderId));
            }}
          >
            <Trash2 size={15} /> {d.remove}
          </Button>
        </div>
      </Card>
    );

  const canSend = orderStatus === "confirmed";
  return (
    <Card className="space-y-3" data-testid="shipment">
      <h2 className="font-semibold">{d.shipment}</h2>
      {accounts.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 space-y-1 text-sm">
            <span className="block text-muted">{d.sendWith}</span>
            <Select
              value={accountId}
              onChange={(ev) => {
                setAccountId(ev.target.value);
                setOptions(startOptions(accounts.find((a) => a.id === ev.target.value)));
              }}
              aria-label={d.sendWith}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </label>
          <Button disabled={pending || !canSend} onClick={() => run(() => sendToCarrier(lang, orderId, accountId, options))}>
            <Send size={15} /> {d.send}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {d.noCarrier}{" "}
          {deliveryHref && (
            <Link href={deliveryHref} className="font-semibold text-accent hover:underline">
              {d.connectLink}
            </Link>
          )}
        </p>
      )}
      {accounts.length > 0 && (
        <div className="rounded-lg border border-line">
          <button type="button" onClick={() => setShowOptions(!showOptions)} aria-expanded={showOptions} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold" data-testid="parcel-options-toggle">
            {d.options.title}
            <span className="text-xs font-normal text-muted">
              {d.options.kinds[options.kind]}
              {options.fragile ? ` · ${d.options.fragileShort}` : ""}
              {options.weight ? ` · ${options.weight} kg` : ""}
            </span>
          </button>
          {showOptions && (
            <div className="border-t border-line p-3">
              <ParcelOptionsFields value={options} onChange={setOptions} idPrefix="po" t={t} />
            </div>
          )}
        </div>
      )}
      {!canSend && accounts.length > 0 && <p className="text-xs text-muted">{e.confirmFirst}</p>}
      {error && <Alert>{error}</Alert>}

      {manual ? (
        <form onSubmit={manualForm.onSubmit} noValidate className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2" data-testid="manual-shipment">
          {/* A connected company: its parcel is then followed automatically like the ones sent from here */}
          {accounts.length > 0 && (
            <Field label={d.manualCompany} htmlFor="manualAccount" hint={manualAccount ? d.manualTracked : d.manualNotTracked}>
              <Select id="manualAccount" name="accountId" value={manualAccount} onChange={(ev) => setManualAccount(ev.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value="">{d.manualOther}</option>
              </Select>
            </Field>
          )}
          {!manualAccount && (
            <Field label={d.carrierName} htmlFor="carrierName" error={fieldError(manualForm.state, e, "carrierName")}>
              <Input id="carrierName" name="carrierName" />
            </Field>
          )}
          <Field label={d.trackingNumber} htmlFor="trackingNumber" error={fieldError(manualForm.state, e, "trackingNumber")}>
            <Input id="trackingNumber" name="trackingNumber" dir="ltr" />
          </Field>
          {manualForm.state.error && manualForm.state.error !== "checkFields" && <Alert>{errorText(t, manualForm.state)}</Alert>}
          <div className="sm:col-span-2">
            <SubmitButton pending={manualForm.pending} variant="secondary" pendingText={t.common.loading}>
              {t.common.save}
            </SubmitButton>
          </div>
        </form>
      ) : (
        <button type="button" className="text-sm font-semibold text-accent hover:underline" onClick={() => setManual(true)}>
          {d.manual}
        </button>
      )}
    </Card>
  );
}
