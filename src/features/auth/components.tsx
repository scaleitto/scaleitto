"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { localeNames, locales, type Locale } from "@/i18n/config";
import { CircleCheck } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { Logo } from "@/ui/Logo";
import type { ActionState } from "@/lib/action";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

// Sign-in and sign-up: the form on a white side, the platform's promise on the deep-green side (large screens)
export function AuthShell({ lang, t, title, subtitle, children }: { lang: Locale; t: Dictionary; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-panel lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href={`/${lang}`} className="flex items-center gap-2.5">
            <Logo name={t.brand} textClass="text-lg" />
          </Link>
          <LanguageSwitcher current={lang} />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">{title}</h1>
          <p className="mt-2 mb-7 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-sidebar to-ink p-12 text-white lg:flex lg:flex-col lg:justify-end" aria-hidden>
        <div className="pointer-events-none absolute -top-32 -end-32 size-[28rem] rounded-full bg-accent-bright/20 blur-3xl" />
        <div className="relative max-w-md space-y-6">
          <p className="text-3xl leading-snug font-bold">{t.landing.title}</p>
          <ul className="space-y-3 text-white/80">
            {t.landing.journey.slice(1, 5).map(([title, hint]) => (
              <li key={title} className="flex gap-3">
                <CircleCheck size={18} className="mt-0.5 shrink-0 text-accent-bright" />
                <span>
                  <span className="block font-semibold text-white">{title}</span>
                  <span className="text-sm">{hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function LoginForm({ lang, t, action }: { lang: Locale; t: Dictionary; action: Action }) {
  const { state, pending, onSubmit } = useActionForm(action);
  const e = t.errors as Record<string, string>;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} errors={e} />
      <Field label={t.auth.email} htmlFor="email" error={fieldError(state, e, "email")}>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required />
      </Field>
      <Field label={t.auth.password} htmlFor="password" error={fieldError(state, e, "password")}>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required />
      </Field>
      <Link href={`/${lang}/forgot`} className="-mt-2 block text-end text-xs font-semibold text-accent hover:underline">
        {t.auth.forgot}
      </Link>
      <SubmitButton pending={pending} className="w-full" pendingText={t.common.loading}>
        {t.auth.submitLogin}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link href={`/${lang}/register`} className="font-semibold text-accent">
          {t.auth.registerTitle}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ lang, t, action, link }: { lang: Locale; t: Dictionary; action: Action; link: { prefix: string; suffix: string } }) {
  const { state, pending, onSubmit } = useActionForm(action);
  const e = t.errors as Record<string, string>;
  const [slug, setSlug] = useState("");
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} errors={e} />
      <Field label={t.auth.name} htmlFor="name" error={fieldError(state, e, "name")}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.auth.email} htmlFor="email" error={fieldError(state, e, "email")}>
          <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required />
        </Field>
        <Field label={t.auth.phone} htmlFor="phone" error={fieldError(state, e, "phone")}>
          <Input id="phone" name="phone" type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="0555 12 34 56" required />
        </Field>
      </div>
      <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordHint} error={fieldError(state, e, "password")}>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" required />
      </Field>
      <Field label={t.auth.shopName} htmlFor="shopName" error={fieldError(state, e, "shopName")}>
        <Input id="shopName" name="shopName" required />
      </Field>
      <Field label={t.auth.shopSlug} htmlFor="shopSlug" hint={t.auth.shopSlugHint} error={fieldError(state, e, "shopSlug")}>
        <div className="flex items-stretch overflow-hidden rounded-[10px] border border-field-line bg-field focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20" dir="ltr">
          {link.prefix && <span className="flex items-center border-e border-field-line bg-panel-2 px-2.5 text-xs whitespace-nowrap text-muted">{link.prefix}</span>}
          <input
            id="shopSlug"
            name="shopSlug"
            placeholder="mystore"
            required
            value={slug}
            onChange={(ev) => setSlug(ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
          />
          {link.suffix && <span className="flex items-center border-s border-field-line bg-panel-2 px-2.5 text-xs whitespace-nowrap text-muted">{link.suffix}</span>}
        </div>
        <p className="mt-1.5 truncate text-xs font-medium text-accent" dir="ltr" data-testid="store-link-preview">
          {link.prefix}
          {slug || "mystore"}
          {link.suffix}
        </p>
      </Field>
      <Field label={t.auth.storeLanguage} htmlFor="storeLanguage" hint={t.auth.storeLanguageHint} error={fieldError(state, e, "storeLanguage")}>
        <Select id="storeLanguage" name="storeLanguage" defaultValue={lang}>
          {locales.map((l) => (
            <option key={l} value={l}>
              {localeNames[l]}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText={t.common.loading}>
        {t.auth.submitRegister}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link href={`/${lang}/login`} className="font-semibold text-accent">
          {t.auth.loginTitle}
        </Link>
      </p>
    </form>
  );
}

// "Forgot your password?": the email, then the same message whether an account exists or not
export function ForgotForm({ lang, t, action }: { lang: Locale; t: Dictionary; action: Action }) {
  const { state, pending, onSubmit } = useActionForm(action);
  const e = t.errors as Record<string, string>;
  if (state.ok)
    return (
      <div className="space-y-4" data-testid="forgot-sent">
        <Alert variant="success">{t.auth.forgotSent}</Alert>
        <Link href={`/${lang}/login`} className="block text-center text-sm font-semibold text-accent">
          {t.auth.backToLogin}
        </Link>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} errors={e} />
      <Field label={t.auth.email} htmlFor="email" error={fieldError(state, e, "email")}>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText={t.common.loading}>
        {t.auth.forgotSubmit}
      </SubmitButton>
      <Link href={`/${lang}/login`} className="block text-center text-sm font-semibold text-accent">
        {t.auth.backToLogin}
      </Link>
    </form>
  );
}

export function ResetForm({ t, action }: { t: Dictionary; action: Action }) {
  const { state, pending, onSubmit } = useActionForm(action);
  const e = t.errors as Record<string, string>;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} errors={e} />
      <Field label={t.auth.newPassword} htmlFor="password" hint={t.auth.passwordHint} error={fieldError(state, e, "password")}>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" required />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText={t.common.loading}>
        {t.auth.resetSubmit}
      </SubmitButton>
    </form>
  );
}

// The waiting page of an owner whose email is not confirmed yet
export function ResendVerification({ t, action }: { t: Dictionary; action: () => Promise<ActionState> }) {
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const e = t.errors as Record<string, string>;
  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={() => startTransition(async () => setState(await action()))} data-testid="resend-verify">
        {t.auth.resend}
      </Button>
      {state && (state.ok ? <Alert variant="success">{t.auth.resent}</Alert> : <Alert>{e[state.error ?? "unexpected"] ?? e.unexpected}</Alert>)}
    </div>
  );
}
