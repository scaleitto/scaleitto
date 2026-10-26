"use client";

import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Card, Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import type { ActionState } from "@/lib/action";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ProfileForm({ t, action, user }: { t: Dictionary; action: Action; user: { name: string; email: string; phone: string | null } }) {
  const { state, pending, onSubmit } = useActionForm(action);
  const e = t.errors as Record<string, string>;
  return (
    <Card>
      <h2 className="mb-4 font-semibold">{t.profile.info}</h2>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <Field label={t.auth.email} htmlFor="email">
          <Input id="email" value={user.email} disabled dir="ltr" />
        </Field>
        <Field label={t.auth.name} htmlFor="name" error={fieldError(state, e, "name")}>
          <Input id="name" name="name" defaultValue={user.name} required />
        </Field>
        <Field label={t.profile.phone} htmlFor="phone" error={fieldError(state, e, "phone")}>
          <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={user.phone ?? ""} />
        </Field>
        <SubmitButton pending={pending} pendingText={t.common.loading}>{t.common.save}</SubmitButton>
      </form>
    </Card>
  );
}

export function PasswordForm({ t, action }: { t: Dictionary; action: Action }) {
  const { state, pending, onSubmit } = useActionForm(action);
  const e = t.errors as Record<string, string>;
  return (
    <Card>
      <h2 className="mb-4 font-semibold">{t.profile.security}</h2>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormMessage state={state} errors={e} success={t.profile.passwordChanged} />
        <Field label={t.profile.currentPassword} htmlFor="currentPassword" error={fieldError(state, e, "currentPassword")}>
          <Input id="currentPassword" name="currentPassword" type="password" dir="ltr" autoComplete="current-password" />
        </Field>
        <Field label={t.profile.newPassword} htmlFor="newPassword" hint={t.auth.passwordHint} error={fieldError(state, e, "newPassword")}>
          <Input id="newPassword" name="newPassword" type="password" dir="ltr" autoComplete="new-password" />
        </Field>
        <SubmitButton pending={pending} variant="secondary" pendingText={t.common.loading}>
          {t.profile.changePassword}
        </SubmitButton>
      </form>
    </Card>
  );
}
