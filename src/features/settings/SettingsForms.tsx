"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck, Clock, Globe } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { locales } from "@/i18n/config";
import { fmt } from "@/lib/format";
import { policyKinds, type PolicyKind } from "@/lib/enums";
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { removeDomain, saveGeneral, savePolicies, saveSeo, setDomain, verifyDomain } from "./actions";

type Text = Pick<Dictionary, "settings" | "errors" | "common">;

export function GeneralForm({ lang, values, t }: { lang: string; values: { name: string; phone: string; defaultLocale: string; slug: string }; t: Text }) {
  const g = t.settings.general;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveGeneral.bind(null, lang));
  const [slug, setSlug] = useState(values.slug);
  return (
    <Card data-testid="settings-general">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <h2 className="font-semibold">{g.title}</h2>
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={g.name} htmlFor="st-name" error={fieldError(state, e, "name")}>
            <Input id="st-name" name="name" dir="auto" maxLength={120} defaultValue={values.name} />
          </Field>
          <Field label={g.phone} htmlFor="st-phone" hint={g.phoneHint} error={fieldError(state, e, "phone")}>
            <Input id="st-phone" name="phone" dir="ltr" inputMode="tel" defaultValue={values.phone} placeholder="0555 12 34 56" />
          </Field>
          <Field label={g.language} htmlFor="st-locale" hint={g.languageHint}>
            <Select id="st-locale" name="defaultLocale" defaultValue={values.defaultLocale}>
              {locales.map((l) => (
                <option key={l} value={l}>
                  {g.languages[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={g.slug} htmlFor="st-slug" error={fieldError(state, e, "slug")}>
            <Input id="st-slug" name="slug" dir="ltr" maxLength={40} value={slug} onChange={(ev) => setSlug(ev.target.value.toLowerCase())} />
            {slug !== values.slug && <p className="mt-1.5 text-xs text-warning">{g.slugWarning}</p>}
          </Field>
        </div>
        <p className="text-xs text-muted">{g.currency}</p>
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          {t.common.save}
        </SubmitButton>
      </form>
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
