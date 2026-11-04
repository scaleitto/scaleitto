"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, CircleCheck, Clock, Globe, Play, Volume2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { policyKinds, type PolicyKind } from "@/lib/enums";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { removeDomain, saveCheckoutFields, saveGeneral, saveOptionButtons, savePolicies, saveSeo, saveSlug, saveStoreLanguage, setDomain, verifyDomain } from "./actions";
import { SwitchRow } from "@/ui/Switch";
import { alertSounds, defaultPrefs, playSound, readPrefs, writePrefs, type AlertPrefs, type AlertSound } from "@/features/shell/alerts";

type Text = Pick<Dictionary, "settings" | "errors" | "common">;

// The fixed start of a social link before the username (Zimam's prefixed inputs)
function Prefixed({ id, name, prefix, value, error, label, placeholder }: { id: string; name: string; prefix?: string; value: string; error?: string; label: string; placeholder: string }) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex overflow-hidden rounded-xl border border-field-line bg-field focus-within:ring-2 focus-within:ring-accent/30" dir="ltr">
        {prefix && <span className="flex items-center border-e border-field-line bg-panel-2 px-3 text-sm text-muted">{prefix}</span>}
        <input id={id} name={name} defaultValue={value} placeholder={placeholder} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
      </div>
    </Field>
  );
}

// Store settings → General (Zimam): name, description, location, social profiles, phone, "Save changes"
export function GeneralForm({ lang, values, t }: { lang: string; values: { name: string; phone: string; description: string; location: string; instagram: string; tiktok: string; facebook: string; telegram: string }; t: Text }) {
  const g = t.settings.general;
  const st = t.settings.g;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveGeneral.bind(null, lang));
  const user = (url: string, re: RegExp) => url.replace(re, "");
  return (
    <Card data-testid="settings-general">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <Field label={g.name} htmlFor="st-name" error={fieldError(state, e, "name")}>
          <Input id="st-name" name="name" dir="auto" maxLength={120} defaultValue={values.name} />
        </Field>
        <Field label={st.description} htmlFor="st-description" error={fieldError(state, e, "description")}>
          <Textarea id="st-description" name="description" dir="auto" rows={3} maxLength={1000} defaultValue={values.description} placeholder={st.descriptionPlaceholder} />
        </Field>
        <Field label={st.location} htmlFor="st-location" error={fieldError(state, e, "location")}>
          <Input id="st-location" name="location" dir="auto" maxLength={160} defaultValue={values.location} placeholder={st.locationPlaceholder} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Prefixed id="st-instagram" name="instagram" label="Instagram" prefix="instagram.com/" value={user(values.instagram, /^https:\/\/(www\.)?instagram\.com\//)} placeholder={st.username} error={fieldError(state, e, "instagram")} />
          <Prefixed id="st-tiktok" name="tiktok" label="TikTok" prefix="tiktok.com/@" value={user(values.tiktok, /^https:\/\/(www\.)?tiktok\.com\/@?/)} placeholder={st.username} error={fieldError(state, e, "tiktok")} />
          <Prefixed id="st-facebook" name="facebook" label="Facebook" value={values.facebook.replace(/^https:\/\//, "")} placeholder="facebook.com/username" error={fieldError(state, e, "facebook")} />
          <Prefixed id="st-telegram" name="telegram" label="Telegram" prefix="t.me/" value={user(values.telegram, /^https:\/\/(t|telegram)\.me\//)} placeholder={st.username} error={fieldError(state, e, "telegram")} />
        </div>
        <Field label={st.phone} htmlFor="st-phone" hint={g.phoneHint} error={fieldError(state, e, "phone")}>
          <Input id="st-phone" name="phone" dir="ltr" inputMode="tel" defaultValue={values.phone} placeholder="0555 12 34 56" />
        </Field>
        <SubmitButton pending={pending} pendingText={t.common.loading} className="h-12 w-full">
          {st.saveChanges}
        </SubmitButton>
      </form>
    </Card>
  );
}

// Zimam's "Device push notifications": the browser's permission, then the sound and volume of new-order alerts (this device)
export function NotificationsCard({ t }: { t: Text }) {
  const n = t.settings.notify;
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const [prefs, setPrefs] = useState<AlertPrefs>(defaultPrefs);
  useEffect(() => {
    // Read once in the browser (not during server rendering)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    setPrefs(readPrefs());
  }, []);
  const update = (p: AlertPrefs) => {
    setPrefs(p);
    writePrefs(p);
  };
  return (
    <Card className="space-y-4" data-testid="settings-notifications">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <BellRing size={18} className="text-accent" /> {n.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{n.hint}</p>
      </div>
      {permission === "denied" ? (
        <Alert variant="error">
          <span className="block font-semibold">{n.blocked}</span>
          {n.blockedHint}
        </Alert>
      ) : permission === "granted" ? (
        <Alert variant="success">{n.enabled}</Alert>
      ) : permission === "unsupported" ? (
        <Alert variant="info">{n.unsupported}</Alert>
      ) : permission === "default" ? (
        <Button type="button" onClick={async () => setPermission(await Notification.requestPermission())} data-testid="enable-notifications">
          <BellRing size={15} /> {n.enable}
        </Button>
      ) : null}
      <div className="grid gap-5 rounded-xl border border-line bg-panel-2/50 p-4 md:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <Volume2 size={16} className="text-accent" /> {n.sounds}
          </p>
          <p className="mt-1 text-sm text-muted">{n.soundsHint}</p>
          <p className="mt-1 text-xs text-muted">{n.soundsNote}</p>
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{n.newOrders}</p>
          <div className="flex gap-2">
            <Select aria-label={n.newOrders} value={prefs.sound} onChange={(ev) => update({ ...prefs, sound: ev.target.value as AlertSound })} data-testid="alert-sound">
              {alertSounds.map((k) => (
                <option key={k} value={k}>
                  {n.soundNames[k]}
                </option>
              ))}
            </Select>
            <Button type="button" variant="secondary" className="shrink-0" disabled={prefs.sound === "none"} onClick={() => playSound(prefs.sound, prefs.volume)}>
              <Play size={14} /> {n.play}
            </Button>
          </div>
          <label className="block space-y-1.5">
            <span className="flex justify-between text-xs font-semibold text-fg-2">
              {n.volume} <span>{Math.round(prefs.volume * 100)}%</span>
            </span>
            <input type="range" min={0} max={100} value={Math.round(prefs.volume * 100)} onChange={(ev) => update({ ...prefs, volume: Number(ev.target.value) / 100 })} className="w-full accent-[var(--color-accent)]" data-testid="alert-volume" />
          </label>
        </div>
      </div>
    </Card>
  );
}

// Store settings → Domain: the store's link on the platform
export function SlugForm({ lang, slug, host, t }: { lang: string; slug: string; host: string; t: Text }) {
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveSlug.bind(null, lang));
  const [value, setValue] = useState(slug);
  return (
    <Card data-testid="settings-slug">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <h2 className="font-semibold">{t.settings.dom.storeDomain}</h2>
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <Field label={t.settings.general.slug} htmlFor="st-slug" error={fieldError(state, e, "slug")}>
          <div className="flex overflow-hidden rounded-xl border border-field-line bg-field" dir="ltr">
            <span className="flex items-center border-e border-field-line bg-panel-2 px-3 text-sm text-muted">{host}</span>
            <input id="st-slug" name="slug" maxLength={40} value={value} onChange={(ev) => setValue(ev.target.value.toLowerCase())} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
          </div>
          {value !== slug && <p className="mt-1.5 text-xs text-warning">{t.settings.general.slugWarning}</p>}
        </Field>
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {t.settings.g.saveChanges}
        </SubmitButton>
      </form>
    </Card>
  );
}

// Store settings → Language: choice cards, saved at once
export function LanguagePicker({ lang, current, t }: { lang: string; current: string; t: Text }) {
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const names = { ar: "العربية (Arabic)", en: "English", fr: "Français (French)" } as const;
  return (
    <Card className="space-y-4" data-testid="settings-language">
      <div>
        <h2 className="font-semibold">{t.settings.langTab.title}</h2>
        <p className="mt-1 text-sm text-muted">{t.settings.langTab.hint}</p>
        <p className="mt-1 text-xs text-muted">{t.settings.langTab.savedNote}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["ar", "en", "fr"] as const).map((l) => (
          <button
            key={l}
            type="button"
            disabled={pending}
            aria-pressed={value === l}
            onClick={() => {
              setValue(l);
              setSaved(false);
              start(async () => setSaved((await saveStoreLanguage(lang, l)).ok === true));
            }}
            className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-start font-semibold transition ${value === l ? "border-accent bg-accent-soft/50" : "border-line hover:border-fg-2/30"}`}
            data-locale={l}
          >
            {names[l]}
            {value === l && <CircleCheck size={18} className="text-accent" />}
          </button>
        ))}
      </div>
      {saved && <p className="text-sm text-accent" data-testid="language-saved">{t.common.saved}</p>}
    </Card>
  );
}

type Rule = "hidden" | "optional" | "required";

// Store settings → Checkout (Zimam): what the buyer is asked, field by field
export function CheckoutFieldsForm({ lang, values, t }: { lang: string; values: { name: Rule; commune: Rule; address: Rule; delivery: "hidden" | "optional" }; t: Text }) {
  const c = t.settings.co;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveCheckoutFields.bind(null, lang));
  const [v, setV] = useState(values);
  const row = (key: string, label: string, hint: string, choices: readonly Rule[], fixed?: Rule) => (
    <div className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between" data-field-rule={key}>
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        <p className="mt-0.5 text-sm text-muted">{hint}</p>
      </div>
      <div className="flex shrink-0 rounded-xl border border-line bg-panel-2 p-1" role="radiogroup" aria-label={label}>
        {(fixed ? [fixed] : choices).map((r) => {
          const on = fixed ? true : (v as Record<string, string>)[key] === r;
          return (
            <label key={r} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold ${on ? "bg-panel text-fg shadow-sm" : "text-muted"}`}>
              {!fixed && <input type="radio" name={key} value={r} checked={on} onChange={() => setV({ ...v, [key]: r })} className="sr-only" />}
              {c[r]}
            </label>
          );
        })}
      </div>
    </div>
  );
  return (
    <Card data-testid="settings-checkout">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <h2 className="font-semibold">{c.title}</h2>
          <p className="mt-1 text-sm text-muted">{c.hint}</p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted">
            <li>{c.legendHidden}</li>
            <li>{c.legendOptional}</li>
            <li>{c.legendRequired}</li>
          </ul>
        </div>
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <div>
          {row("phone", c.phone, c.phoneHint, [], "required")}
          {row("name", c.name, c.nameHint, ["hidden", "optional", "required"])}
          {row("wilaya", c.wilaya, c.wilayaHint, [], "required")}
          {row("commune", c.commune, c.communeHint, ["hidden", "optional", "required"])}
          {row("address", c.address, c.addressHint, ["hidden", "optional", "required"])}
          {row("delivery", c.delivery, c.deliveryHint, ["hidden", "optional"])}
        </div>
        <SubmitButton pending={pending} pendingText={t.common.loading} className="h-12 w-full">
          {c.save}
        </SubmitButton>
      </form>
    </Card>
  );
}

// Store settings → Product page: options always as buttons (saved at once)
export function ProductPageForm({ lang, optionButtons, t }: { lang: string; optionButtons: boolean; t: Text }) {
  const [on, setOn] = useState(optionButtons);
  const [pending, start] = useTransition();
  return (
    <Card data-testid="settings-product-page">
      <SwitchRow
        label={t.settings.pp.buttons}
        hint={t.settings.pp.buttonsHint}
        checked={on}
        disabled={pending}
        onChange={(value) => {
          setOn(value);
          start(async () => {
            if (!(await saveOptionButtons(lang, value)).ok) setOn(!value);
          });
        }}
        testId="option-buttons"
      />
    </Card>
  );
}

export function SeoForm({ lang, values, shopName, url, t }: { lang: string; values: { title: string; description: string }; shopName: string; url: string; t: Text }) {
  const s = t.settings.seo;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveSeo.bind(null, lang));
  const [title, setTitle] = useState(values.title);
  const [description, setDescription] = useState(values.description);
  return (
    <Card data-testid="settings-seo">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <h2 className="font-semibold">{s.title}</h2>
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <Field label={s.metaTitle} htmlFor="seo-title" hint={`${s.metaTitleHint} · ${title.length}/70`} error={fieldError(state, e, "title")}>
          <Input id="seo-title" name="title" dir="auto" maxLength={70} value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder={shopName} />
        </Field>
        <Field label={s.metaDescription} htmlFor="seo-description" hint={`${s.metaDescriptionHint} · ${description.length}/160`} error={fieldError(state, e, "description")}>
          <Textarea id="seo-description" name="description" dir="auto" rows={2} maxLength={160} value={description} onChange={(ev) => setDescription(ev.target.value)} />
        </Field>
        {/* How it looks in search results (always light, like Google) */}
        <div className="rounded-lg bg-white p-4" dir="auto">
          <p className="text-xs text-slate-500">{s.preview}</p>
          <p className="truncate text-xs text-accent" dir="ltr">
            {url}
          </p>
          <p className="truncate text-lg text-blue-800">{title || shopName}</p>
          {description && <p className="line-clamp-2 text-sm text-slate-600">{description}</p>}
        </div>
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {t.common.save}
        </SubmitButton>
      </form>
    </Card>
  );
}

export function PoliciesForm({ lang, values, t }: { lang: string; values: Partial<Record<PolicyKind, string>>; t: Text }) {
  const p = t.settings.policies;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(savePolicies.bind(null, lang));
  return (
    <Card data-testid="settings-policies">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <h2 className="font-semibold">{p.title}</h2>
          <p className="mt-0.5 text-sm text-muted">{p.hint}</p>
        </div>
        <FormMessage state={state} errors={e} success={t.common.saved} />
        {policyKinds.map((k) => (
          <Field key={k} label={p.kinds[k]} htmlFor={`policy-${k}`} error={fieldError(state, e, k)}>
            <Textarea id={`policy-${k}`} name={k} dir="auto" rows={4} maxLength={10_000} defaultValue={values[k] ?? ""} placeholder={p.placeholder} />
          </Field>
        ))}
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {t.common.save}
        </SubmitButton>
      </form>
    </Card>
  );
}

type DomainState = { allowed: boolean; domain: string | null; token: string | null; verified: boolean; target: { cname: string | null; ip: string | null } };

export function DomainCard({ lang, state: d, plansHref, t }: { lang: string; state: DomainState; plansHref: string | null; t: Text }) {
  const dm = t.settings.domain;
  const e = t.errors as Record<string, string>;
  const form = useActionForm(setDomain.bind(null, lang));
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const records = d.domain && d.token
    ? [
        { type: "TXT", name: `_scaleitto.${d.domain}`, value: `scaleitto-verify=${d.token}`, note: dm.txtNote },
        ...(d.target.cname ? [{ type: "CNAME", name: `www.${d.domain}`, value: d.target.cname, note: dm.pointNote }] : []),
        ...(d.target.ip ? [{ type: "A", name: "@", value: d.target.ip, note: dm.pointNote }] : []),
      ]
    : [];
  return (
    <Card className="space-y-4" data-testid="settings-domain" data-state={!d.domain ? "none" : d.verified ? "verified" : "pending"}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Globe size={20} />
        </span>
        <div>
          <h2 className="font-semibold">{dm.title}</h2>
          <p className="mt-0.5 text-sm text-muted">{dm.description}</p>
        </div>
      </div>
      {!d.allowed ? (
        <Alert variant="info">
          {dm.planRequired}{" "}
          {plansHref && (
            <Link href={plansHref} className="font-semibold underline">
              {dm.upgrade}
            </Link>
          )}
        </Alert>
      ) : (
        <>
          <form onSubmit={form.onSubmit} noValidate className="flex flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1">
              <FormMessage state={form.state} errors={e} />
              <Field label={dm.label} htmlFor="domain" error={fieldError(form.state, e, "domain")}>
                <Input id="domain" name="domain" dir="ltr" defaultValue={d.domain ?? ""} placeholder="mystore.com" />
              </Field>
            </div>
            <SubmitButton pending={form.pending} variant="secondary" pendingText={t.common.loading} className="mb-[1.4rem]">
              {dm.save}
            </SubmitButton>
          </form>
          {d.domain &&
            (d.verified ? (
              <Alert variant="success">
                <CircleCheck size={16} className="me-1 inline" /> {fmt(dm.verified, { domain: d.domain })}
              </Alert>
            ) : (
              <div className="space-y-3">
                <Badge tone="warning">
                  <Clock size={12} className="me-1 inline" /> {dm.pending}
                </Badge>
                <p className="text-sm text-muted">{dm.steps}</p>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-sm" dir="ltr" data-testid="dns-records">
                    <thead className="text-xs text-muted">
                      <tr className="border-b border-line">
                        <th className="p-2 text-start font-medium">{dm.columns.type}</th>
                        <th className="p-2 text-start font-medium">{dm.columns.name}</th>
                        <th className="p-2 text-start font-medium">{dm.columns.value}</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      {records.map((r) => (
                        <tr key={r.type} className="border-b border-line last:border-0" title={r.note}>
                          <td className="p-2 font-semibold">{r.type}</td>
                          <td className="p-2 break-all select-all">{r.name}</td>
                          <td className="p-2 break-all select-all" data-record={r.type}>
                            {r.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted">{dm.dnsNote}</p>
              </div>
            ))}
          {result && <Alert variant={result.ok ? "success" : "error"}>{result.text}</Alert>}
          {d.domain && (
            <div className="flex flex-wrap gap-2">
              {!d.verified && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await verifyDomain(lang);
                      setResult(r.ok ? null : { ok: false, text: `${e[r.error ?? "unexpected"] ?? e.unexpected}${r.message ? ` — ${fmt(dm.found, { records: r.message })}` : ""}` });
                    })
                  }
                >
                  {dm.verify}
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={busy}
                className="hover:text-danger"
                onClick={() => {
                  if (confirm(dm.confirmRemove)) startTransition(async () => void (await removeDomain(lang)));
                }}
              >
                {dm.remove}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
