"use client";

import { useRef, useState, useTransition } from "react";
import { Copy, Mail, Plus, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, Select, inputClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { cancelInvite, inviteMember } from "./invites";

type Text = Pick<Dictionary, "team" | "errors" | "profile">;
type Member = { userId: string; name: string; email: string; role: "owner" | "manager" | "agent"; active: boolean };
type Invite = { id: string; email: string; role: "owner" | "manager" | "agent"; expires: string };

// Team (Zimam): the counter against the plan's staff limit, "+ Invite" (email + role), the active teammates and the
// invitations still waiting
export function TeamInvites({ lang, members, invites, used, max, canInviteManagers, t }: { lang: string; members: Member[]; invites: Invite[]; used: number; max: number; canInviteManagers: boolean; t: Text }) {
  const i = t.team.invite;
  const errors = t.errors as Record<string, string>;
  const dialog = useRef<HTMLDialogElement>(null);
  const { state, pending, onSubmit } = useActionForm(inviteMember.bind(null, lang));
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const roleLabel = (r: Member["role"]) => (r === "owner" ? t.profile.roles.owner : i.roles[r]);
  return (
    <div className="space-y-6" data-testid="team-page">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-panel-2 px-3 py-1 text-sm font-semibold tabular-nums" data-testid="team-count">
          {max < 0 ? fmt(i.unlimited, { used }) : fmt(i.count, { used, max })}
        </span>
        <Button type="button" onClick={() => dialog.current?.showModal()} data-testid="invite-open">
          <Plus size={16} /> {i.button}
        </Button>
      </div>

      <dialog ref={dialog} className="m-auto w-[min(460px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="invite-dialog">
        <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{i.title}</h2>
            <button type="button" aria-label={i.cancel} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => dialog.current?.close()}>
              <X size={18} />
            </button>
          </div>
          <Field label={i.email} htmlFor="invite-email" error={fieldError(state, errors, "email")}>
            <Input id="invite-email" name="email" type="email" dir="ltr" autoComplete="off" />
          </Field>
          <Field label={i.role} htmlFor="invite-role">
            <Select id="invite-role" name="role" defaultValue="agent">
              {canInviteManagers && <option value="manager">{i.roles.manager}</option>}
              <option value="agent">{i.roles.agent}</option>
            </Select>
          </Field>
          {state.ok && state.message ? (
            <div className="space-y-2" data-testid="invite-link">
              <Alert variant="success">{i.sent}</Alert>
              <div className="flex gap-2">
                <input readOnly value={state.message} dir="ltr" className={`${inputClass} text-xs`} />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    void navigator.clipboard?.writeText(state.message ?? "");
                    setCopied(true);
                  }}
                >
                  <Copy size={14} /> {copied ? "✓" : ""}
                </Button>
              </div>
            </div>
          ) : (
            <FormMessage state={state} errors={errors} />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>
              {i.cancel}
            </Button>
            <SubmitButton pending={pending} data-testid="invite-send">
              {i.send}
            </SubmitButton>
          </div>
        </form>
      </dialog>

      {invites.length > 0 && (
        <Card className="space-y-3 p-0" data-testid="invites">
          <h2 className="px-4 pt-4 text-xs font-semibold tracking-wide text-muted uppercase">{i.pending}</h2>
          <ul className="divide-y divide-line">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm" data-invite={inv.email}>
                <Mail size={16} className="text-muted" />
                <span className="font-medium" dir="ltr">
                  {inv.email}
                </span>
                <Badge>{roleLabel(inv.role)}</Badge>
                <span className="text-xs text-muted">{fmt(i.expires, { at: inv.expires })}</span>
                <Button type="button" variant="ghost" className="ms-auto" disabled={busy} onClick={() => start(async () => void (await cancelInvite(lang, inv.id)))} data-testid="invite-revoke">
                  {i.revoke}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3 p-0" data-testid="members">
        <h2 className="px-4 pt-4 text-xs font-semibold tracking-wide text-muted uppercase">{i.active}</h2>
        {members.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">{i.none}</p>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm" data-member={m.email}>
                <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">{m.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-xs text-muted" dir="ltr">
                    {m.email}
                  </span>
                </span>
                <span className="ms-auto">
                  <Badge tone={m.role === "owner" ? "violet" : m.role === "manager" ? "accent" : "neutral"}>{roleLabel(m.role)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="px-4 pb-4 text-xs text-muted">{i.manageAgents}</p>
      </Card>
    </div>
  );
}
