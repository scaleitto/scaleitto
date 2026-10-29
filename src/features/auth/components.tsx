"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Locale } from "@/i18n/config";
import { CircleCheck } from "lucide-react";
import { Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import type { ActionState } from "@/lib/action";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

// Sign-in and sign-up: the form on a white side, the platform's promise on the deep-green side (large screens)
export function AuthShell({ lang, t, title, subtitle, children }: { lang: Locale; t: Dictionary; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-panel lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href={`/${lang}`} className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b7cf6] to-[#4f3bd6] font-bold text-white">{t.brand.charAt(0)}</span>
            <span className="text-lg font-bold tracking-tight">{t.brand}</span>
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

export function RegisterForm({ lang, t, action, rootDomain }: { lang: Locale; t: Dictionary; action: Action; rootDomain: string }) {
  const { state, pending, onSubmit } = useActionForm(action);
  const e = t.errors as Record<string, string>;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} errors={e} />
      <Field label={t.auth.name} htmlFor="name" error={fieldError(state, e, "name")}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label={t.auth.email} htmlFor="email" error={fieldError(state, e, "email")}>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" required />
      </Field>
      <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordHint} error={fieldError(state, e, "password")}>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" required />
      </Field>
      <Field label={t.auth.shopName} htmlFor="shopName" error={fieldError(state, e, "shopName")}>
        <Input id="shopName" name="shopName" required />
      </Field>
      <Field label={t.auth.shopSlug} htmlFor="shopSlug" hint={t.auth.shopSlugHint} error={fieldError(state, e, "shopSlug")}>
        <div className="flex items-center gap-2" dir="ltr">
          <Input id="shopSlug" name="shopSlug" placeholder="mystore" required />
          <span className="whitespace-nowrap text-sm text-muted">.{rootDomain}</span>
        </div>
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
