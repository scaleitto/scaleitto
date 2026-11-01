"use client";

import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";

export function AcceptInviteForm({ action, t }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; t: Pick<Dictionary, "team" | "errors"> }) {
  const a = t.team.invite.accept;
  const errors = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={a.name} htmlFor="name" error={fieldError(state, errors, "name")}>
        <Input id="name" name="name" autoComplete="name" />
      </Field>
      <Field label={a.password} htmlFor="password" error={fieldError(state, errors, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" dir="ltr" />
      </Field>
      <FormMessage state={state} errors={errors} />
      <SubmitButton pending={pending} className="w-full" data-testid="invite-accept-submit">
        {a.submit}
      </SubmitButton>
    </form>
  );
}
