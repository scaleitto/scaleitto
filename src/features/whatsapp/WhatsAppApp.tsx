"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Clock, Coins, Languages, MessageCircle, Package, Save, Smartphone } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Button, Card, Field, Select, buttonClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { SwitchRow } from "@/ui/Switch";
import { waNotices, type WhatsAppSettings } from "@/features/apps/settings";
import { requestWhatsAppNumber, saveWhatsApp } from "@/features/apps/settings-actions";

type Text = Pick<Dictionary, "apps" | "errors" | "common">;
const hours = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

// Apps → WhatsApp order confirmation (Zimam's page): the switch and its cost, quiet hours, reminder, language, which
// orders, the customer notifications and "Connect my WhatsApp number"
export function WhatsAppApp({
  lang,
  settings,
  products,
  balance,
  balanceHref,
  ready,
  month,
  costs,
  reminderHours,
  t,
}: {
  lang: string;
  settings: WhatsAppSettings;
  products: { id: string; name: string }[];
  balance: number;
  balanceHref: string;
  ready: boolean;
  month: { sent: number; confirmed: number; cancelled: number };
  costs: { whatsapp: number; notification: number };
  reminderHours: number;
  t: Text;
}) {
  const w = t.apps.whatsapp;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveWhatsApp.bind(null, lang));
  const [scope, setScope] = useState<"all" | "selected">(settings.products ? "selected" : "all");
  const [connecting, startConnect] = useTransition();
  const productsError = fieldError(state, e, "products");

  return (
    <form onSubmit={onSubmit} className="space-y-5" data-testid="app-form">
      <FormMessage state={state} errors={e} success={t.apps.saved} />
      {!ready && (
        <div data-testid="wa-not-ready">
          <Alert variant="info">{w.notReady}</Alert>
        </div>
      )}

      <Card className="space-y-4 p-6">
        <SwitchRow name="enabled" defaultChecked={settings.enabled} label={w.enable} hint={w.enableHint} icon={<MessageCircle size={18} />} testId="app-enabled" />
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-panel-2/60 p-4 text-sm">
          <Coins size={18} className="mt-0.5 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-fg-2">{fmt(w.cost, { n: costs.whatsapp, h: reminderHours })}</p>
          <div className="flex items-center gap-3">
            <span className="font-semibold tabular-nums" data-testid="wa-balance">
              {fmt(w.balance, { n: balance })}
            </span>
            <Link href={balanceHref} className={buttonClass("secondary")}>
              {w.topUp}
            </Link>
          </div>
        </div>
        <p className="text-xs text-muted" data-testid="wa-month">
          {fmt(w.month, month)}
        </p>
      </Card>

      <Section icon={<Clock size={17} />} title={w.quietTitle} hint={w.quietHint}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={w.from} htmlFor="wa-from">
            <Select id="wa-from" name="quietFrom" defaultValue={settings.quietFrom} data-testid="wa-quiet-from">
              {hours.map((h) => (
                <option key={h} value={h}>
                  {hh(h)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={w.until} htmlFor="wa-until">
            <Select id="wa-until" name="quietTo" defaultValue={settings.quietTo} data-testid="wa-quiet-to">
              {hours.map((h) => (
                <option key={h} value={h}>
                  {hh(h)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <SwitchRow name="reminder" defaultChecked={settings.reminder} label={w.reminder} hint={w.reminderHint} testId="wa-reminder" />
      </Section>

      <Section icon={<Languages size={17} />} title={w.language}>
        <div className="grid gap-2 sm:grid-cols-4">
          {(["", "ar", "fr", "en"] as const).map((l) => (
            <label key={l || "store"} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line p-3 text-sm font-medium has-checked:border-accent has-checked:bg-accent-soft/40">
              <input type="radio" name="language" value={l} defaultChecked={settings.language === l} className="size-4 accent-[var(--color-accent)]" data-testid={`wa-lang-${l || "store"}`} />
              {l === "" ? w.storeLanguage : l === "ar" ? "العربية" : l === "fr" ? "Français" : "English"}
            </label>
          ))}
        </div>
      </Section>

      <Section icon={<Package size={17} />} title={w.scopeTitle} hint={w.scopeHint}>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["all", "selected"] as const).map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line p-3 text-sm font-medium has-checked:border-accent has-checked:bg-accent-soft/40">
              <input type="radio" name="scope" value={s} checked={scope === s} onChange={() => setScope(s)} className="size-4 accent-[var(--color-accent)]" data-testid={`wa-scope-${s}`} />
              {w.scopes[s]}
            </label>
          ))}
        </div>
        {scope === "selected" && (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line p-2" data-testid="wa-products">
            {products.length === 0 && <p className="px-2 py-1.5 text-sm text-muted">{w.noProducts}</p>}
            {products.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel-2">
                <input type="checkbox" name="products" value={p.id} defaultChecked={settings.products?.includes(p.id)} className="size-4 accent-[var(--color-accent)]" />
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        )}
        {productsError && <p className="text-sm text-danger">{productsError}</p>}
      </Section>

      <Section icon={<BellRing size={17} />} title={w.noticesTitle} hint={fmt(w.noticesHint, { n: costs.notification })}>
        <div className="divide-y divide-line">
          {waNotices.map((k) => (
            <div key={k} className="py-3 first:pt-0 last:pb-0">
              <SwitchRow name={`notify_${k}`} defaultChecked={settings.notify[k]} label={w.notices[k].label} hint={<>{w.notices[k].hint} <span className="text-xs font-semibold text-warning">· {fmt(w.perMessage, { n: costs.notification })}</span></>} testId={`wa-notify-${k}`} />
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<Smartphone size={17} />} title={w.numberTitle} hint={w.numberText}>
        {settings.connectRequested ? (
          <div data-testid="wa-queued">
            <Alert variant="info">{fmt(w.queued, { date: new Date(settings.connectRequested).toLocaleDateString(lang === "ar" ? "ar-DZ" : lang) })}</Alert>
          </div>
        ) : (
          <div className="space-y-2">
            <Button type="button" variant="secondary" disabled={connecting} onClick={() => startConnect(async () => void (await requestWhatsAppNumber(lang)))} data-testid="wa-connect">
              <Smartphone size={15} /> {w.connect}
            </Button>
            <p className="text-xs text-muted">{w.connectHint}</p>
          </div>
        )}
      </Section>

      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText={t.common.loading} className="h-12 px-6" data-testid="app-save">
          <Save size={17} /> {t.apps.saveSettings}
        </SubmitButton>
      </div>
    </form>
  );
}
