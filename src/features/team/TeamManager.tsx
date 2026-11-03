"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Copy, ExternalLink, Headphones, Headset, KeyRound, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import type { MemberRole, WorkSchedule } from "@/server/db/schema";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { addMember, removeMember, resetMemberPassword, setMemberActive, updateMember } from "./actions";
import { isInternalEmail } from "./validators";
import { useModal } from "@/ui/useModal";

export type TeamText = Pick<Dictionary, "team" | "profile" | "errors" | "common">;
export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  created: string;
  role: MemberRole;
  active: boolean;
  schedule: WorkSchedule | null;
  online: boolean;
  presence: string; // "Started today: 09:04" / "Not in today"
};

const errorsOf = (t: TeamText) => t.errors as Record<string, string>;

// "Create New Agent" (Zimam): full name, optional email, username and password; the agent signs in to the portal
function AddAgentDialog({ lang, t, onDone }: { lang: string; t: TeamText; onDone: () => void }) {
  const ag = t.team.agents;
  const e = errorsOf(t);
  const ref = useModal();
  const [round, setRound] = useState(0);
  const { state, pending, onSubmit } = useActionForm(async (prev: ActionState, fd: FormData) => {
    const r = await addMember(lang, prev, fd);
    if (r.ok) {
      ref.current?.close();
      setRound((n) => n + 1);
      onDone();
    }
    return r;
  });
  return (
    <>
      <Button type="button" className="h-12 px-6 text-base" onClick={() => ref.current?.showModal()} data-testid="add-agent">
        <Plus size={16} /> {ag.add}
      </Button>
      <dialog ref={ref} className="m-auto w-[min(768px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="agent-dialog">
        <form key={round} onSubmit={onSubmit} noValidate data-testid="add-member">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold">{ag.dialogTitle}</h2>
            <button type="button" aria-label={ag.cancel} className="grid size-8 place-items-center rounded-full bg-panel-2 text-fg-2 hover:bg-line" onClick={() => ref.current?.close()}>
              <X size={16} />
            </button>
          </div>
          <div className="space-y-4 px-5 py-5">
            <FormMessage state={state} errors={e} />
            <Field label={`${ag.fullName} *`} htmlFor="m-name" error={fieldError(state, e, "name")}>
              <Input id="m-name" name="name" autoComplete="off" placeholder={ag.fullName} />
            </Field>
            <Field label={ag.email} htmlFor="m-email" error={fieldError(state, e, "email")}>
              <Input id="m-email" name="email" type="email" dir="ltr" autoComplete="off" placeholder={ag.emailPlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${ag.username} *`} htmlFor="m-username" error={fieldError(state, e, "username")}>
                <Input id="m-username" name="username" dir="ltr" autoComplete="off" autoCapitalize="none" placeholder={ag.username} title={ag.usernameHint} />
              </Field>
              <Field label={`${ag.password} *`} htmlFor="m-password" error={fieldError(state, e, "password")}>
                <Input id="m-password" name="password" type="password" dir="ltr" autoComplete="new-password" placeholder="••••••••" title={ag.passwordHint} />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-line px-5 py-4">
            <Button type="button" variant="secondary" className="h-12 text-base" onClick={() => ref.current?.close()}>
              {ag.cancel}
            </Button>
            <SubmitButton pending={pending} pendingText={t.common.loading} className="col-span-2 h-12 text-base" data-testid="create-agent">
              {ag.create}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

// Where agents sign in: the portal link (with the store ID filled) and the store ID itself
function PortalLink({ url, storeId, t }: { url: string; storeId: string; t: TeamText }) {
  const ag = t.team.agents;
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
  };
  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3" data-testid="portal-link">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold">{ag.portalTitle}</p>
        <p className="text-xs text-muted">{ag.portalHint}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted">{ag.storeId}</span>
        <code className="rounded-md bg-panel-2 px-2 py-1 font-semibold" dir="ltr" data-testid="store-id">
          {storeId}
        </code>
        <a href={url} target="_blank" rel="noreferrer" className="max-w-72 truncate text-xs font-medium text-accent hover:underline" dir="ltr">
          {url}
        </a>
        <Button type="button" variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => copy("url", url)}>
          <Copy size={14} /> {copied === "url" ? ag.copied : ag.copy}
        </Button>
      </div>
    </Card>
  );
}

function ScheduleFields({ schedule, t, error }: { schedule: WorkSchedule | null; t: TeamText; error?: string }) {
  const tm = t.team;
  const [enabled, setEnabled] = useState(Boolean(schedule));
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="hasSchedule" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
        {tm.hasSchedule}
      </label>
      <div className={enabled ? "space-y-3" : "hidden"}>
        <div className="flex flex-wrap gap-1.5">
          {tm.days.map((label, day) => (
            <label key={day} className="cursor-pointer">
              <input type="checkbox" name="days" value={day} defaultChecked={schedule ? schedule.days.includes(day) : day <= 4} className="peer sr-only" />
              <span className="inline-block rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:text-accent">{label}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{tm.from}</span>
          <Input type="time" name="start" aria-label={tm.from} dir="ltr" className="w-32" defaultValue={schedule?.start ?? "09:00"} />
          <span className="text-muted">{tm.to}</span>
          <Input type="time" name="end" aria-label={tm.to} dir="ltr" className="w-32" defaultValue={schedule?.end ?? "17:00"} />
        </div>
      </div>
    </div>
  );
}

function scheduleSummary(s: WorkSchedule | null, t: TeamText) {
  if (!s) return t.team.noSchedule;
  return (
    <>
      {s.days.map((d) => t.team.days[d]).join("، ")} ·{" "}
      <bdi dir="ltr">
        {s.start}–{s.end}
      </bdi>
    </>
  );
}

function MemberCard({ lang, member, t, viewer, portal }: { lang: string; member: MemberRow; t: TeamText; viewer: { userId: string; role: MemberRole }; portal: { url: string; storeId: string } }) {
  const tm = t.team;
  const e = errorsOf(t);
  const [mode, setMode] = useState<"view" | "edit" | "password">("view");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSelf = member.userId === viewer.userId;
  const manageable = !isSelf && member.role !== "owner" && (viewer.role === "owner" || member.role === "agent");
  const editable = manageable || (isSelf && viewer.role === "owner");
  const edit = useActionForm(async (prev: ActionState, fd: FormData) => {
    const r = await updateMember(lang, member.userId, prev, fd);
    if (r.ok) setMode("view");
    return r;
  });
  const password = useActionForm(resetMemberPassword.bind(null, lang, member.userId));
  const [copied, setCopied] = useState(false);
  const ag = t.team.agents;
  const iconButton = "grid h-9 w-16 place-items-center rounded-full bg-panel-2 text-fg-2 transition-colors hover:bg-line disabled:opacity-50";

  return (
    <Card className={`space-y-4 ${member.active ? "" : "opacity-60"}`} data-member={member.email} data-username={member.username ?? undefined}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-bright text-white shadow-[0_8px_18px_-10px_var(--color-accent)]">
          <Headset size={22} aria-hidden />
          <span className={`absolute -end-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-panel ${member.online ? "bg-emerald-500" : "bg-line"}`} title={member.online ? tm.online : undefined} data-online={member.online} />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {member.name}
            {isSelf && <span className="text-xs text-muted">({tm.you})</span>}
            {member.role !== "agent" && <Badge tone={member.role === "owner" ? "accent" : "neutral"}>{t.profile.roles[member.role]}</Badge>}
            {!member.active && <Badge tone="danger">{tm.inactive}</Badge>}
          </p>
          {member.username && (
            <p className="text-sm text-accent" dir="ltr" data-testid="member-username">
              @{member.username}
            </p>
          )}
          {!isInternalEmail(member.email) && (
            <p className="truncate text-sm text-fg-2" dir="ltr">
              {member.email}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clock size={13} /> {scheduleSummary(member.schedule, t)}
          </p>
        </div>
      </div>
      {/* Zimam's row of round buttons: edit, copy the sign-in details, open the agents' portal, delete */}
      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <button type="button" className={iconButton} aria-label={tm.edit} title={tm.edit} onClick={() => setMode(mode === "edit" ? "view" : "edit")} data-testid="agent-edit">
            <Pencil size={16} />
          </button>
        )}
        {member.username && (
          <button
            type="button"
            className={iconButton}
            aria-label={ag.copyLogin}
            title={ag.copyLogin}
            onClick={() => {
              void navigator.clipboard?.writeText(fmt(ag.loginText, { url: portal.url, store: portal.storeId, username: member.username ?? "" }));
              setCopied(true);
            }}
            data-testid="agent-copy"
          >
            {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
          </button>
        )}
        {member.role === "agent" && (
          <a href={portal.url} target="_blank" rel="noreferrer" className={iconButton} aria-label={ag.openPortal} title={ag.openPortal} data-testid="agent-portal">
            <ExternalLink size={16} />
          </a>
        )}
        {manageable && (
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-danger hover:bg-danger/10 disabled:opacity-50"
            aria-label={ag.remove}
            title={ag.remove}
            disabled={pending}
            onClick={() => {
              if (!confirm(ag.confirmRemove)) return;
              startTransition(async () => {
                const r = await removeMember(lang, member.userId);
                setError(r.ok ? null : (e[r.error ?? "unexpected"] ?? e.unexpected));
              });
            }}
            data-testid="agent-remove"
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[11px] font-semibold tracking-wide text-muted uppercase">
        <span>{fmt(ag.created, { at: member.created })}</span>
        <span className="normal-case" data-testid="presence">
          {member.online ? tm.online : member.presence}
        </span>
      </div>
      {error && <Alert>{error}</Alert>}

      {mode === "edit" && (
        <form onSubmit={edit.onSubmit} noValidate className="space-y-4 border-t border-line pt-4">
          <FormMessage state={edit.state} errors={e} />
          {member.role === "owner" ? (
            <input type="hidden" name="role" value="manager" />
          ) : (
            <Field label={tm.role} htmlFor={`role-${member.userId}`}>
              <Select id={`role-${member.userId}`} name="role" defaultValue={member.role} className="max-w-56">
                <option value="agent">{t.profile.roles.agent}</option>
                {(viewer.role === "owner" || member.role === "manager") && <option value="manager">{t.profile.roles.manager}</option>}
              </Select>
            </Field>
          )}
          <p className="text-sm font-medium">{tm.schedule}</p>
          <ScheduleFields schedule={member.schedule} t={t} error={fieldError(edit.state, e, "days")} />
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton pending={edit.pending} pendingText={t.common.loading}>
              {t.common.save}
            </SubmitButton>
            {manageable && (
              <>
                <Button type="button" variant="ghost" className="text-xs" onClick={() => setMode("password")}>
                  <KeyRound size={14} /> {tm.resetPassword}
                </Button>
                <Button
                  type="button"
                  variant={member.active ? "danger" : "secondary"}
                  className="text-xs"
                  disabled={pending}
                  onClick={() => {
                    if (member.active && !confirm(tm.confirmDeactivate)) return;
                    startTransition(async () => {
                      const r = await setMemberActive(lang, member.userId, !member.active);
                      setError(r.ok ? null : (e[r.error ?? "unexpected"] ?? e.unexpected));
                    });
                  }}
                >
                  <Power size={14} /> {member.active ? tm.deactivate : tm.activate}
                </Button>
              </>
            )}
          </div>
        </form>
      )}

      {mode === "password" && (
        <form onSubmit={password.onSubmit} noValidate className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <Field label={tm.password} htmlFor={`pw-${member.userId}`} error={fieldError(password.state, e, "password")}>
            <Input id={`pw-${member.userId}`} name="password" dir="ltr" autoComplete="new-password" className="w-56" />
          </Field>
          <SubmitButton pending={password.pending} variant="secondary" pendingText={t.common.loading}>
            {tm.resetPassword}
          </SubmitButton>
          {password.state.ok && <Alert variant="success">{tm.passwordReset}</Alert>}
          {password.state.error && password.state.error !== "checkFields" && <Alert>{e[password.state.error] ?? e.unexpected}</Alert>}
        </form>
      )}
    </Card>
  );
}

export function TeamManager({ lang, members, viewer, portal, t }: { lang: string; members: MemberRow[]; viewer: { userId: string; role: MemberRole }; portal: { url: string; storeId: string }; t: TeamText }) {
  const [added, setAdded] = useState(false);
  const ag = t.team.agents;
  // The owner manages the store from the dashboard; the cards are the people who answer the phone (and managers)
  const people = members.filter((m) => m.role !== "owner");
  return (
    <div className="space-y-4" data-testid="call-center">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{ag.title}</h1>
        <AddAgentDialog lang={lang} t={t} onDone={() => setAdded(true)} />
      </div>
      {added && <Alert variant="success">{t.team.added}</Alert>}
      {/* Zimam's empty state; the agents' sign-in link appears once there is someone to give it to */}
      {people.length > 0 && <PortalLink url={portal.url} storeId={portal.storeId} t={t} />}
      {people.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-20 text-center" data-testid="no-agents">
          <span className="grid size-16 place-items-center rounded-full bg-accent text-white">
            <Headphones size={28} />
          </span>
          <h2 className="text-xl font-bold">{ag.noneTitle}</h2>
          <p className="text-muted">{ag.none}</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {people.map((m) => (
            <MemberCard key={m.userId} lang={lang} member={m} t={t} viewer={viewer} portal={portal} />
          ))}
        </div>
      )}
    </div>
  );
}
