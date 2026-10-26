"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Locale } from "@/i18n/config";
import { Card, Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import type { ActionState } from "@/lib/action";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function AuthShell({ lang, t, title, subtitle, children }: { lang: Locale; t: Dictionary; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href={`/${lang}`} className="mb-6 text-3xl font-extrabold text-accent">
        {t.brand}
      </Link>
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mb-5 mt-1 text-sm text-muted">{subtitle}</p>
        {children}
      </Card>
      <div className="mt-6">
        <LanguageSwitcher current={lang} />
      </div>
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
