"use client";

import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Locale } from "@/i18n/config";
import { Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { agentLogin } from "./portal";

// The call-center portal's sign-in (Zimam): store ID, username, password
export function AgentLoginForm({ lang, t, store }: { lang: Locale; t: Dictionary; store?: string }) {
  const { state, pending, onSubmit } = useActionForm(agentLogin.bind(null, lang));
  const e = t.errors as Record<string, string>;
  const l = t.portal.login;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate data-testid="agent-login">
      <FormMessage state={state} errors={e} />
      <Field label={l.store} htmlFor="store" error={fieldError(state, e, "store")}>
        <Input id="store" name="store" dir="ltr" autoComplete="organization" defaultValue={store} required />
      </Field>
      <Field label={l.username} htmlFor="username" error={fieldError(state, e, "username")}>
        <Input id="username" name="username" dir="ltr" autoComplete="username" autoCapitalize="none" required />
      </Field>
      <Field label={l.password} htmlFor="password" error={fieldError(state, e, "password")}>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText={t.common.loading}>
        {l.submit}
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href={`/${lang}/login`} className="font-semibold text-accent">
          {l.owner}
        </Link>
      </p>
    </form>
  );
}
