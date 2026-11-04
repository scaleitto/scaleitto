"use client";

import { useState, useTransition } from "react";
import { Copy, Mail, Plus, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input, Select, inputClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { cancelInvite, inviteMember } from "./invites";
import { removeMember } from "./actions";
import { useModal } from "@/ui/useModal";

type Text = Pick<Dictionary, "team" | "errors" | "profile">;
type Member = { userId: string; name: string; email: string; role: "owner" | "manager" | "agent"; active: boolean };
type Invite = { id: string; email: string; role: "owner" | "manager" | "agent"; expires: string };

// Team (Zimam): the counter against the plan's staff limit, "+ Invite" (email + role), the active teammates and the
// invitations still waiting
export function TeamInvites({ lang, title, description, members, invites, used, max, canInviteManagers, t }: { lang: string; title: string; description: string; members: Member[]; invites: Invite[]; used: number; max: number; canInviteManagers: boolean; t: Text }) {
  const i = t.team.invite;
  const errors = t.errors as Record<string, string>;
  const dialog = useModal();
  const { state, pending, onSubmit } = useActionForm(inviteMember.bind(null, lang));
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const roleLabel = (r: Member["role"]) => (r === "owner" ? t.profile.roles.owner : i.roles[r]);
  return (
    <div className="space-y-6" data-testid="team-page">
      {/* Zimam: the title on one side, the teammates counter above "+ Invite" on the other (the owner is not counted) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-[1.7rem]">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-sm font-semibold tabular-nums" data-testid="team-count">
            {max < 0 ? fmt(i.unlimited, { used }) : fmt(i.count, { used, max })}
          </span>
          <Button type="button" onClick={() => dialog.current?.showModal()} data-testid="invite-open">
            <Plus size={16} /> {i.button}
          </Button>
        </div>
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

      <section className="space-y-2" data-testid="members">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{i.active}</h2>
        {members.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel px-4 py-6 text-center text-sm text-muted" data-testid="team-empty">
            {i.none}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm" data-member={m.email}>
                <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">{m.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-xs text-muted" dir="ltr">
                    {m.email}
                  </span>
                </span>
                <span className="ms-auto flex items-center gap-2">
                  <Badge tone={m.role === "owner" ? "violet" : m.role === "manager" ? "accent" : "neutral"}>{roleLabel(m.role)}</Badge>
                  {(canInviteManagers || m.role === "agent") && (
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                      aria-label={i.remove}
                      title={i.remove}
                      disabled={busy}
                      onClick={() => confirm(i.confirmRemove) && start(async () => void (await removeMember(lang, m.userId)))}
                      data-testid="member-remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">{i.manageAgents}</p>
      </section>
    </div>
  );
}
