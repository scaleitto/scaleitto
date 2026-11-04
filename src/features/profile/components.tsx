"use client";

// Profile like Zimam: personal information (name, email, phone, dashboard language) saved by one button, the password in a
// row that opens, and the account deletion request.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Globe, Lock, Mail, Phone, Save, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { locales, type Locale } from "@/i18n/config";
import { Card, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import type { ActionState } from "@/lib/action";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
const names: Record<Locale, string> = { ar: "العربية", fr: "Français", en: "English" };

export function ProfileForm({ t, lang, action, user }: { t: Dictionary; lang: Locale; action: Action; user: { name: string; email: string; phone: string | null } }) {
  const p = t.profile;
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(lang);
  const { state, pending, onSubmit } = useActionForm(action);
  const [last, setLast] = useState(state);
  // Saved in another language: open the dashboard in it
  if (state !== last) {
    setLast(state);
    if (state.ok && locale !== lang) router.push(`/${locale}/dashboard/profile`);
  }
  const e = t.errors as Record<string, string>;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" data-testid="profile-form">
      <Card className="space-y-5 p-6">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold">
          <Mail size={19} className="text-accent" /> {p.personal}
        </h2>
        <FormMessage state={state} errors={e} success={t.common.saved} />
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={p.fullName} htmlFor="name" error={fieldError(state, e, "name")}>
            <Input id="name" name="name" defaultValue={user.name} required autoComplete="name" />
          </Field>
          <Field label={t.auth.email} htmlFor="email">
            <Input id="email" value={user.email} readOnly dir="ltr" className="text-muted" />
          </Field>
        </div>
        <Field label={p.phone} htmlFor="phone" error={fieldError(state, e, "phone")}>
          <div className="relative" dir="ltr">
            <Phone size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={user.phone ?? ""} className="ps-10 text-start" autoComplete="tel" />
          </div>
        </Field>
        <div className="space-y-1.5">
          <label htmlFor="locale" className="flex items-center gap-2 text-sm font-semibold">
            <Globe size={16} className="text-muted" /> {p.language}
          </label>
          <p className="text-xs text-muted">{p.languageHint}</p>
          <Select id="locale" name="locale" value={locale} onChange={(ev) => setLocale(ev.target.value as Locale)}>
            {locales.map((l) => (
              <option key={l} value={l}>
                {names[l]}
              </option>
            ))}
          </Select>
        </div>
      </Card>
      {/* Zimam: Save Changes under the cards, at the end of the line */}
      <div className="flex justify-end" data-testid="profile-save">
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          <Save size={16} /> {p.save}
        </SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm({ t, action }: { t: Dictionary; action: Action }) {
  const { state, pending, onSubmit } = useActionForm(action);
  const e = t.errors as Record<string, string>;
  return (
    <Card className="p-0">
      <details className="group" data-testid="password-panel">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 p-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
          <Lock size={19} className="text-accent" /> <span className="flex-1">{t.profile.security}</span>
          <ChevronDown size={18} className="text-muted transition-transform group-open:rotate-180" />
        </summary>
        <form onSubmit={onSubmit} className="space-y-4 px-6 pb-6" noValidate>
          <FormMessage state={state} errors={e} success={t.profile.passwordChanged} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t.profile.currentPassword} htmlFor="currentPassword" error={fieldError(state, e, "currentPassword")}>
              <Input id="currentPassword" name="currentPassword" type="password" dir="ltr" autoComplete="current-password" />
            </Field>
            <Field label={t.profile.newPassword} htmlFor="newPassword" hint={t.auth.passwordHint} error={fieldError(state, e, "newPassword")}>
              <Input id="newPassword" name="newPassword" type="password" dir="ltr" autoComplete="new-password" />
            </Field>
          </div>
          <SubmitButton pending={pending} variant="secondary" pendingText={t.common.loading}>
            {t.profile.changePassword}
          </SubmitButton>
        </form>
      </details>
    </Card>
  );
}

// The request goes to the platform's support (WhatsApp) with the account's email; the platform checks and handles it
export function DeleteAccount({ t, href }: { t: Dictionary; href: string | null }) {
  const p = t.profile;
  return (
    <Card className="space-y-3 p-6" data-testid="delete-account">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <Trash2 size={19} className="text-danger" /> {p.deleteTitle}
      </h2>
      <p className="text-sm leading-relaxed text-muted">{p.deleteText}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl bg-danger px-5 text-sm font-semibold text-white hover:opacity-90" data-testid="request-deletion">
          {p.deleteButton}
        </a>
      ) : (
        <p className="text-sm font-medium">{p.deleteNoSupport}</p>
      )}
    </Card>
  );
}
