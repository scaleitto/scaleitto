"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { BadgeCheck, CircleCheckBig, Download, Info, MessageCircle, Phone, RotateCcw, Save, ShieldCheck, Smartphone, Truck, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { SwitchRow } from "@/ui/Switch";
import type { ProtectionSettings } from "@/lib/enums";
import { type BadgeKey, type ContactSettings, type ThanksSettings, type TrackingSettings, type TrustBadge } from "./settings";
import { saveAppSwitch, saveAssignMode, saveOrderGuard, saveQuickContact, saveThankYou, saveTracking, saveTrustBadges, setIpBlocked, setPhoneBlockedApp } from "./settings-actions";

type Text = Pick<Dictionary, "apps" | "errors" | "common">;

// Zimam's info banner at the top of an app page
export function HowItWorks({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-info/25 bg-info/5 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info/10 text-info">
        <Info size={19} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-info/90">
        <p className="mb-1 font-semibold text-info">{title}</p>
        {children}
      </div>
    </div>
  );
}

function SaveBar({ pending, label, t }: { pending: boolean; label?: string; t: Text }) {
  return (
    <div className="flex justify-end">
      <SubmitButton pending={pending} pendingText={t.common.loading} className="h-12 px-6" data-testid="app-save">
        <Save size={17} /> {label ?? t.apps.saveSettings}
      </SubmitButton>
    </div>
  );
}

// Abandoned orders, parcel scanner: one switch
export function SwitchApp({ lang, app, enabled, label, hint, children, t }: { lang: string; app: "abandoned" | "scanner"; enabled: boolean; label: string; hint: string; children?: ReactNode; t: Text }) {
  const { state, pending, onSubmit } = useActionForm(saveAppSwitch.bind(null, lang, app));
  return (
    <form onSubmit={onSubmit} className="space-y-5" data-testid="app-form">
      <FormMessage state={state} errors={t.errors as Record<string, string>} success={t.apps.saved} />
      <Card className="space-y-4 p-6">
        <SwitchRow name="enabled" defaultChecked={enabled} label={label} hint={hint} testId="app-enabled" />
        {children}
      </Card>
      <SaveBar pending={pending} t={t} />
    </form>
  );
}

const orderLimits = [1, 2, 3, 5, 10];
const windows = [1, 3, 6, 12, 24, 48, 72];

export function OrderGuardForm({ lang, settings, t }: { lang: string; settings: ProtectionSettings; t: Text }) {
  const g = t.apps.guard;
  const { state, pending, onSubmit } = useActionForm(saveOrderGuard.bind(null, lang));
  const [enabled, setEnabled] = useState(settings.enabled);
  const hours = (n: number) => (n % 24 === 0 ? fmt(n === 24 ? g.day : g.days, { n: n / 24 }) : fmt(n === 1 ? g.hour : g.hours, { n }));
  const limits = orderLimits.includes(settings.maxPerPhonePerDay) ? orderLimits : [...orderLimits, settings.maxPerPhonePerDay].sort((a, b) => a - b);
  const wins = windows.includes(settings.duplicateHours) ? windows : [...windows, settings.duplicateHours].sort((a, b) => a - b);
  return (
    <form onSubmit={onSubmit} className="space-y-5" data-testid="app-form">
      <FormMessage state={state} errors={t.errors as Record<string, string>} success={t.apps.saved} />
      <Card className="space-y-5 p-6">
        <SwitchRow name="enabled" checked={enabled} onChange={setEnabled} label={g.enable} hint={g.enableHint} icon={<ShieldCheck size={18} />} testId="app-enabled" />
        <p className="flex items-center gap-2 text-sm">
          <span className="text-muted">{g.status}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${enabled ? "bg-accent-soft text-accent-ink" : "bg-panel-2 text-muted"}`}>{enabled ? t.apps.grid.active : t.apps.grid.inactive}</span>
        </p>
      </Card>
      <fieldset disabled={!enabled} className="space-y-5 disabled:opacity-60">
        <Card className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={g.perPhone} htmlFor="g-per-phone" hint={g.perPhoneHint}>
              <Select id="g-per-phone" name="maxPerPhonePerDay" defaultValue={String(settings.maxPerPhonePerDay)}>
                {limits.map((n) => (
                  <option key={n} value={n}>
                    {fmt(n === 1 ? g.order : g.orders, { n })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={g.window} htmlFor="g-window" hint={g.windowHint}>
              <Select id="g-window" name="duplicateHours" defaultValue={String(settings.duplicateHours)}>
                {wins.map((n) => (
                  <option key={n} value={n}>
                    {hours(n)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="space-y-4 border-t border-line pt-5">
            <SwitchRow name="blockDuplicates" defaultChecked={settings.blockDuplicates} label={g.duplicates} hint={g.duplicatesHint} />
            <SwitchRow name="blockBots" defaultChecked={settings.blockBots} label={g.bots} hint={g.botsHint} />
            <SwitchRow name="useNetwork" defaultChecked={settings.useNetwork} label={g.network} hint={g.networkHint} />
            <SwitchRow name="holdSuspicious" defaultChecked={settings.holdSuspicious} label={g.hold} hint={g.holdHint} />
          </div>
        </Card>
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">{g.advanced}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={g.risk} htmlFor="g-risk" hint={g.riskHint}>
              <Input id="g-risk" name="riskThreshold" type="number" min={10} max={100} defaultValue={settings.riskThreshold} dir="ltr" />
            </Field>
            <Field label={g.maxQuantity} htmlFor="g-qty" hint={g.maxQuantityHint}>
              <Input id="g-qty" name="maxQuantity" type="number" min={0} max={1000} defaultValue={settings.maxQuantity} dir="ltr" />
            </Field>
          </div>
          <Field label={g.words} htmlFor="g-words" hint={g.wordsHint}>
            <Textarea id="g-words" name="blockedWords" rows={3} defaultValue={settings.blockedWords.join("\n")} />
          </Field>
        </Card>
      </fieldset>
      {/* A disabled fieldset sends nothing: keep the values while protection is off */}
      {!enabled && (
        <>
          <input type="hidden" name="maxPerPhonePerDay" value={settings.maxPerPhonePerDay} />
          <input type="hidden" name="duplicateHours" value={settings.duplicateHours} />
          <input type="hidden" name="riskThreshold" value={settings.riskThreshold} />
          <input type="hidden" name="maxQuantity" value={settings.maxQuantity} />
          <input type="hidden" name="blockedWords" value={settings.blockedWords.join("\n")} />
          {settings.blockDuplicates && <input type="hidden" name="blockDuplicates" value="on" />}
          {settings.blockBots && <input type="hidden" name="blockBots" value="on" />}
          {settings.useNetwork && <input type="hidden" name="useNetwork" value="on" />}
          {settings.holdSuspicious && <input type="hidden" name="holdSuspicious" value="on" />}
        </>
      )}
      <SaveBar pending={pending} t={t} />
    </form>
  );
}

const modes = ["balanced", "on_shift", "manual"] as const;
export function AssignModeForm({ lang, mode, agents, teamHref, t }: { lang: string; mode: (typeof modes)[number]; agents: number; teamHref: string; t: Text }) {
  const a = t.apps.assign;
  const { state, pending, onSubmit } = useActionForm(saveAssignMode.bind(null, lang));
  return (
    <form onSubmit={onSubmit} className="space-y-5" data-testid="app-form">
      <FormMessage state={state} errors={t.errors as Record<string, string>} success={t.apps.saved} />
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{a.howTitle}</h2>
          <a href={teamHref} className="text-sm font-semibold text-accent hover:underline">
            {fmt(a.agents, { n: agents })} · {a.manage}
          </a>
        </div>
        <div className="grid gap-3">
          {modes.map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 has-checked:border-accent has-checked:bg-accent-soft/40">
              <input type="radio" name="mode" value={m} defaultChecked={mode === m} className="mt-1 size-4 accent-[var(--color-accent)]" data-testid={`mode-${m}`} />
              <span>
                <span className="block font-semibold">{a.modes[m].title}</span>
                <span className="mt-0.5 block text-sm text-muted">{a.modes[m].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>
      <SaveBar pending={pending} t={t} />
    </form>
  );
}

function useRun(t: Text) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const e = t.errors as Record<string, string>;
  const run = (fn: () => Promise<ActionState>, done?: () => void) =>
    start(async () => {
      const r = await fn().catch((): ActionState => ({ ok: false, error: "unexpected" }));
      if (r.ok) {
        setError(null);
        done?.();
      } else setError(e[Object.values(r.fieldErrors ?? {})[0] ?? r.error ?? "unexpected"] ?? e.unexpected);
    });
  return { pending, error, run };
}

export function BlacklistApp({ lang, phones, ips, t }: { lang: string; phones: { phone: string; reason: string | null; at: string }[]; ips: string[]; t: Text }) {
  const b = t.apps.blacklist;
  const phoneRun = useRun(t);
  const ipRun = useRun(t);
  const [phone, setPhone] = useState("");
  const [ip, setIp] = useState("");
  const head = (cols: string[]) => (
    <thead>
      <tr>
        {cols.map((c) => (
          <th key={c} className="text-start">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
  return (
    <div className="space-y-6">
      <Card className="overflow-x-auto p-0" data-testid="blocked-phones">
        <div className="flex flex-wrap items-end gap-3 p-5">
          <div className="me-auto">
            <h2 className="font-semibold">{b.phones}</h2>
            <p className="mt-0.5 text-sm text-muted">{b.phonesHint}</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              phoneRun.run(() => setPhoneBlockedApp(lang, phone, true), () => setPhone(""));
            }}
          >
            <Input value={phone} onChange={(ev) => setPhone(ev.target.value)} placeholder="0555123456" dir="ltr" className="w-40" aria-label={b.phonePlaceholder} data-testid="block-phone-input" />
            <Button type="submit" disabled={phoneRun.pending || !phone.trim()} data-testid="block-phone">
              {b.block}
            </Button>
          </form>
        </div>
        {phoneRun.error && (
          <div className="px-5 pb-3">
            <Alert>{phoneRun.error}</Alert>
          </div>
        )}
        {phones.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">{b.phonesEmpty}</p>
        ) : (
          <table className="w-full text-sm">
            {head([b.columns.phone, b.columns.reason, b.columns.at, ""])}
            <tbody>
              {phones.map((p) => (
                <tr key={p.phone} data-blocked-phone={p.phone}>
                  <td dir="ltr" className="text-start font-medium">
                    {p.phone}
                  </td>
                  <td className="text-muted">{p.reason ?? "—"}</td>
                  <td className="whitespace-nowrap text-muted">{p.at}</td>
                  <td className="text-end">
                    <Button variant="ghost" className="py-1 text-xs" disabled={phoneRun.pending} onClick={() => phoneRun.run(() => setPhoneBlockedApp(lang, p.phone, false))}>
                      <Trash2 size={14} /> {b.unblock}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto p-0" data-testid="blocked-ips">
        <div className="flex flex-wrap items-end gap-3 p-5">
          <div className="me-auto">
            <h2 className="font-semibold">{b.ips}</h2>
            <p className="mt-0.5 text-sm text-muted">{b.ipsHint}</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              ipRun.run(() => setIpBlocked(lang, ip, true), () => setIp(""));
            }}
          >
            <Input value={ip} onChange={(ev) => setIp(ev.target.value)} placeholder="102.45.0.1" dir="ltr" className="w-40" aria-label={b.ipPlaceholder} data-testid="block-ip-input" />
            <Button type="submit" disabled={ipRun.pending || !ip.trim()} data-testid="block-ip">
              {b.blockIp}
            </Button>
          </form>
        </div>
        {ipRun.error && (
          <div className="px-5 pb-3">
            <Alert>{ipRun.error}</Alert>
          </div>
        )}
        {ips.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">{b.ipsEmpty}</p>
        ) : (
          <table className="w-full text-sm">
            {head([b.columns.ip, ""])}
            <tbody>
              {ips.map((x) => (
                <tr key={x} data-blocked-ip={x}>
                  <td dir="ltr" className="text-start font-medium">
                    {x}
                  </td>
                  <td className="text-end">
                    <Button variant="ghost" className="py-1 text-xs" disabled={ipRun.pending} onClick={() => ipRun.run(() => setIpBlocked(lang, x, false))}>
                      <Trash2 size={14} /> {b.unblock}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const badgeIcons: Record<BadgeKey, typeof BadgeCheck> = { payment: BadgeCheck, returns: RotateCcw, guarantee: ShieldCheck, delivery: Truck };

export function TrustBadgesForm({ lang, badges: initial, defaults, t }: { lang: string; badges: TrustBadge[]; defaults: Record<BadgeKey, { title: string; text: string }>; t: Text }) {
  const b = t.apps.badges;
  const { state, pending, onSubmit } = useActionForm(saveTrustBadges.bind(null, lang));
  const [badges, setBadges] = useState(initial);
  const set = (key: BadgeKey, patch: Partial<TrustBadge>) => setBadges((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const shown = badges.filter((x) => x.on);
  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" data-testid="app-form">
      <div className="space-y-5">
        <FormMessage state={state} errors={t.errors as Record<string, string>} success={t.apps.saved} />
        {badges.map((x) => {
          const Icon = badgeIcons[x.key];
          return (
            <Card key={x.key} className="space-y-4 p-6" data-badge={x.key}>
              <SwitchRow name={`${x.key}.on`} checked={x.on} onChange={(v) => set(x.key, { on: v })} label={b.items[x.key]} hint={b.onProductPage} icon={<Icon size={18} />} testId={`badge-${x.key}`} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={b.titleLabel} htmlFor={`b-${x.key}-title`}>
                  <Input id={`b-${x.key}-title`} name={`${x.key}.title`} maxLength={40} value={x.title} onChange={(ev) => set(x.key, { title: ev.target.value })} placeholder={defaults[x.key].title} />
                </Field>
                <Field label={b.textLabel} htmlFor={`b-${x.key}-text`}>
                  <Input id={`b-${x.key}-text`} name={`${x.key}.text`} maxLength={80} value={x.text} onChange={(ev) => set(x.key, { text: ev.target.value })} placeholder={defaults[x.key].text} />
                </Field>
              </div>
            </Card>
          );
        })}
        <p className="text-xs text-muted">{b.honesty}</p>
        <SaveBar pending={pending} t={t} />
      </div>
      <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
        <div>
          <h2 className="font-semibold">{b.preview}</h2>
          <p className="text-sm text-muted">{b.previewHint}</p>
        </div>
        <Card className="space-y-2 p-4" data-testid="badges-preview">
          {shown.length === 0 ? (
            <p className="text-sm text-muted">{b.none}</p>
          ) : (
            shown.map((x) => {
              const Icon = badgeIcons[x.key];
              return (
                <div key={x.key} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{x.title || defaults[x.key].title}</span>
                    <span className="block text-xs text-muted">{x.text || defaults[x.key].text}</span>
                  </span>
                </div>
              );
            })
          )}
        </Card>
      </aside>
    </form>
  );
}

export function QuickContactForm({ lang, contact, t }: { lang: string; contact: ContactSettings; t: Text }) {
  const c = t.apps.contact;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveQuickContact.bind(null, lang));
  const [phoneOn, setPhoneOn] = useState(contact.phoneOn);
  const [whatsappOn, setWhatsappOn] = useState(contact.whatsappOn);
  return (
    <form onSubmit={onSubmit} className="space-y-5" data-testid="app-form">
      <FormMessage state={state} errors={e} success={t.apps.saved} />
      <Card className="space-y-4 p-6">
        <SwitchRow name="phoneOn" checked={phoneOn} onChange={setPhoneOn} label={c.phone} hint={c.phoneHint} icon={<Phone size={18} />} testId="contact-phone-on" />
        {phoneOn && (
          <Field label={c.phoneNumber} htmlFor="c-phone" error={fieldError(state, e, "phone")}>
            <Input id="c-phone" name="phone" dir="ltr" defaultValue={contact.phone} placeholder="0555123456" />
          </Field>
        )}
        {!phoneOn && <input type="hidden" name="phone" value={contact.phone} />}
      </Card>
      <Card className="space-y-4 p-6">
        <SwitchRow name="whatsappOn" checked={whatsappOn} onChange={setWhatsappOn} label={c.whatsapp} hint={c.whatsappHint} icon={<MessageCircle size={18} />} testId="contact-whatsapp-on" />
        {whatsappOn && (
          <Field label={c.whatsappNumber} htmlFor="c-whatsapp" error={fieldError(state, e, "whatsapp")}>
            <Input id="c-whatsapp" name="whatsapp" dir="ltr" defaultValue={contact.whatsapp} placeholder="0555123456" />
          </Field>
        )}
        {!whatsappOn && <input type="hidden" name="whatsapp" value={contact.whatsapp} />}
      </Card>
      <SaveBar pending={pending} label={c.save} t={t} />
    </form>
  );
}

export function ThankYouForm({ lang, thanks, defaults, t }: { lang: string; thanks: ThanksSettings; defaults: { title: string; message: string; home: string; product: string }; t: Text }) {
  const th = t.apps.thanks;
  const { state, pending, onSubmit } = useActionForm(saveThankYou.bind(null, lang));
  const [v, setV] = useState(thanks);
  const set = (patch: Partial<ThanksSettings>) => setV((x) => ({ ...x, ...patch }));
  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" data-testid="app-form">
      <div className="space-y-5">
        <FormMessage state={state} errors={t.errors as Record<string, string>} success={t.apps.saved} />
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="font-semibold">{th.formTitle}</h2>
            <p className="mt-0.5 text-sm text-muted">{th.formHint}</p>
          </div>
          <Field label={th.main} htmlFor="th-title">
            <Input id="th-title" name="title" maxLength={80} value={v.title} onChange={(ev) => set({ title: ev.target.value })} placeholder={defaults.title} />
          </Field>
          <Field label={th.sub} htmlFor="th-message">
            <Textarea id="th-message" name="message" rows={3} maxLength={300} value={v.message} onChange={(ev) => set({ message: ev.target.value })} placeholder={defaults.message} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={th.button} htmlFor="th-button">
              <Input id="th-button" name="button" maxLength={40} value={v.button} onChange={(ev) => set({ button: ev.target.value })} placeholder={v.redirect === "product" ? defaults.product : defaults.home} />
            </Field>
            <Field label={th.redirect} htmlFor="th-redirect">
              <Select id="th-redirect" name="redirect" value={v.redirect} onChange={(ev) => set({ redirect: ev.target.value as ThanksSettings["redirect"] })}>
                <option value="home">{th.redirects.home}</option>
                <option value="product">{th.redirects.product}</option>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-muted">{th.emptyHint}</p>
        </Card>
        <SaveBar pending={pending} t={t} />
      </div>
      <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Smartphone size={16} /> {th.preview}
        </h2>
        <div className="mx-auto w-[300px] rounded-[2.2rem] bg-[#0b1220] p-2.5 shadow-xl">
          <div className="space-y-4 rounded-[1.7rem] bg-white px-5 py-10 text-center text-slate-900" data-testid="thanks-preview">
            <CircleCheckBig size={52} className="mx-auto text-emerald-600" />
            <p className="text-lg font-extrabold">{v.title || defaults.title}</p>
            <p className="text-sm text-slate-500">{v.message || defaults.message}</p>
            <p className="rounded-xl bg-slate-50 p-3 text-sm">
              {th.number} <b>#1001</b>
            </p>
            <span className="block rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">{v.button || (v.redirect === "product" ? defaults.product : defaults.home)}</span>
          </div>
        </div>
      </aside>
    </form>
  );
}

export function QrCodeApp({ storeUrl, products, t }: { storeUrl: string; products: { id: string; name: string; slug: string }[]; t: Text }) {
  const q = t.apps.qr;
  const [type, setType] = useState<"store" | "product" | "url">("store");
  const [product, setProduct] = useState(products[0]?.slug ?? "");
  const [url, setUrl] = useState("https://");
  const [image, setImage] = useState<string | null>(null);
  const target = type === "store" ? storeUrl : type === "product" ? (product ? `${storeUrl}/p/${product}` : "") : /^https?:\/\/\S+\.\S+/.test(url.trim()) ? url.trim() : "";
  useEffect(() => {
    let live = true;
    if (!target) return;
    QRCode.toDataURL(target, { width: 1024, margin: 2, errorCorrectionLevel: "M" })
      .then((src) => live && setImage(src))
      .catch(() => live && setImage(null));
    return () => {
      live = false;
    };
  }, [target]);
  const shownImage = target ? image : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold">{q.smartTitle}</h2>
          <p className="mt-0.5 text-sm text-muted">{q.smartHint}</p>
        </div>
        <Field label={q.type} htmlFor="qr-type">
          <Select id="qr-type" value={type} onChange={(ev) => setType(ev.target.value as typeof type)} data-testid="qr-type">
            <option value="store">{q.types.store}</option>
            <option value="product">{q.types.product}</option>
            <option value="url">{q.types.url}</option>
          </Select>
        </Field>
        {type === "product" &&
          (products.length ? (
            <Field label={q.product} htmlFor="qr-product">
              <Select id="qr-product" value={product} onChange={(ev) => setProduct(ev.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-muted">{q.noProducts}</p>
          ))}
        {type === "url" && (
          <Field label={q.url} htmlFor="qr-url">
            <Input id="qr-url" dir="ltr" value={url} onChange={(ev) => setUrl(ev.target.value)} />
          </Field>
        )}
        <p className="text-sm">
          <span className="text-muted">{q.target}: </span>
          <bdi dir="ltr" className="font-medium break-all" data-testid="qr-target">
            {target || "—"}
          </bdi>
        </p>
      </Card>
      <Card className="space-y-4 p-6 text-center">
        {shownImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shownImage} alt={q.title} className="mx-auto size-56 rounded-xl border border-line bg-white p-2" data-testid="qr-image" />
        ) : (
          <div className="mx-auto grid size-56 place-items-center rounded-xl border-2 border-dashed border-line text-sm text-muted">{q.empty}</div>
        )}
        <a href={shownImage ?? undefined} download="qr-code.png" aria-disabled={!shownImage} className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-fg ${shownImage ? "hover:opacity-90" : "pointer-events-none opacity-50"}`} data-testid="qr-download">
          <Download size={16} /> {q.download}
        </a>
        <p className="text-xs text-muted">{q.resolution}</p>
      </Card>
    </div>
  );
}


export function TrackingForm({ lang, tracking, pageHref, t }: { lang: string; tracking: TrackingSettings; pageHref: string; t: Text }) {
  const tr = t.apps.tracking;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveTracking.bind(null, lang));
  const [contact, setContact] = useState(tracking.contact);
  return (
    <form onSubmit={onSubmit} className="space-y-5" data-testid="app-form">
      <FormMessage state={state} errors={e} success={t.apps.saved} />
      <Card className="space-y-4 p-6">
        <SwitchRow name="enabled" defaultChecked={tracking.enabled} label={tr.enable} hint={tr.enableHint} testId="app-enabled" />
        <a href={pageHref} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-accent hover:underline" data-testid="tracking-page">
          {tr.open}
        </a>
      </Card>
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold">{tr.contactTitle}</h2>
          <p className="mt-0.5 text-sm text-muted">{tr.contactHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr.method} htmlFor="tr-contact">
            <Select id="tr-contact" name="contact" value={contact} onChange={(ev) => setContact(ev.target.value as TrackingSettings["contact"])}>
              <option value="">{tr.methods.quick}</option>
              <option value="whatsapp">{tr.methods.whatsapp}</option>
              <option value="phone">{tr.methods.phone}</option>
              <option value="none">{tr.methods.none}</option>
            </Select>
          </Field>
          {(contact === "whatsapp" || contact === "phone") && (
            <Field label={tr.number} htmlFor="tr-number" hint={tr.numberHint} error={fieldError(state, e, "number")}>
              <Input id="tr-number" name="number" dir="ltr" defaultValue={tracking.number} placeholder="0555123456" />
            </Field>
          )}
        </div>
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">{tr.lookupTitle}</h2>
        <div className="grid gap-3">
          {(["phone", "number_phone"] as const).map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 has-checked:border-accent has-checked:bg-accent-soft/40">
              <input type="radio" name="lookup" value={m} defaultChecked={tracking.lookup === m} className="mt-1 size-4 accent-[var(--color-accent)]" data-testid={`lookup-${m}`} />
              <span className="font-semibold">{tr.lookups[m]}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">{tr.lookupHint}</p>
      </Card>
      <SaveBar pending={pending} t={t} />
    </form>
  );
}
