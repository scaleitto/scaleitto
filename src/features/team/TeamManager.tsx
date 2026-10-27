"use client";

import { useState, useTransition } from "react";
import { Clock, KeyRound, Pencil, Power, UserPlus } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import type { MemberRole, WorkSchedule } from "@/server/db/schema";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { addMember, resetMemberPassword, setMemberActive, updateMember } from "./actions";

export type TeamText = Pick<Dictionary, "team" | "profile" | "errors" | "common">;
export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  active: boolean;
  schedule: WorkSchedule | null;
  online: boolean;
  presence: string; // "Started today: 09:04" / "Not in today"
};

const errorsOf = (t: TeamText) => t.errors as Record<string, string>;

function AddMemberForm({ lang, t, canAddManager, onDone }: { lang: string; t: TeamText; canAddManager: boolean; onDone: () => void }) {
  const tm = t.team;
  const e = errorsOf(t);
  const { state, pending, onSubmit } = useActionForm(async (prev: ActionState, fd: FormData) => {
    const r = await addMember(lang, prev, fd);
    if (r.ok) onDone();
    return r;
  });
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="add-member">
        <p className="text-sm text-muted">{tm.addHint}</p>
        <FormMessage state={state} errors={e} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tm.name} htmlFor="m-name" error={fieldError(state, e, "name")}>
            <Input id="m-name" name="name" />
          </Field>
          <Field label={tm.email} htmlFor="m-email" error={fieldError(state, e, "email")}>
            <Input id="m-email" name="email" type="email" dir="ltr" autoComplete="off" />
          </Field>
          <Field label={tm.role} htmlFor="m-role">
            <Select id="m-role" name="role" defaultValue="agent">
              <option value="agent">{t.profile.roles.agent}</option>
              {canAddManager && <option value="manager">{t.profile.roles.manager}</option>}
            </Select>
          </Field>
          <Field label={tm.password} htmlFor="m-password" hint={tm.passwordHint} error={fieldError(state, e, "password")}>
            <Input id="m-password" name="password" dir="ltr" autoComplete="new-password" />
          </Field>
        </div>
        <SubmitButton pending={pending} pendingText={t.common.loading}>
          <UserPlus size={16} /> {tm.addMember}
        </SubmitButton>
      </form>
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

function MemberCard({ lang, member, t, viewer }: { lang: string; member: MemberRow; t: TeamText; viewer: { userId: string; role: MemberRole } }) {
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

  return (
    <Card className={`space-y-3 ${member.active ? "" : "opacity-60"}`} data-member={member.email}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className={`size-2.5 rounded-full ${member.online ? "bg-accent" : "bg-line"}`} title={member.online ? tm.online : undefined} />
            {member.name}
            {isSelf && <span className="text-xs text-muted">({tm.you})</span>}
            <Badge tone={member.role === "agent" ? "info" : member.role === "owner" ? "accent" : "neutral"}>{t.profile.roles[member.role]}</Badge>
            {!member.active && <Badge tone="danger">{tm.inactive}</Badge>}
          </p>
          <p className="truncate text-xs text-muted" dir="ltr">
            {member.email}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clock size={13} /> {scheduleSummary(member.schedule, t)}
          </p>
          <p className="text-xs text-muted" data-testid="presence">
            {member.online ? tm.online : member.presence}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {editable && (
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setMode(mode === "edit" ? "view" : "edit")}>
              <Pencil size={14} /> {tm.edit}
            </Button>
          )}
          {manageable && (
            <>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setMode(mode === "password" ? "view" : "password")}>
                <KeyRound size={14} /> {tm.resetPassword}
              </Button>
              <Button
                variant={member.active ? "danger" : "secondary"}
                className="px-2 py-1 text-xs"
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
          <SubmitButton pending={edit.pending} pendingText={t.common.loading}>
            {t.common.save}
          </SubmitButton>
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

export function TeamManager({ lang, members, viewer, t }: { lang: string; members: MemberRow[]; viewer: { userId: string; role: MemberRole }; t: TeamText }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(!adding)}>
          <UserPlus size={16} /> {t.team.addMember}
        </Button>
      </div>
      {added && <Alert variant="success">{t.team.added}</Alert>}
      {adding && (
        <AddMemberForm
          lang={lang}
          t={t}
          canAddManager={viewer.role === "owner"}
          onDone={() => {
            setAdding(false);
            setAdded(true);
          }}
        />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {members.map((m) => (
          <MemberCard key={m.userId} lang={lang} member={m} t={t} viewer={viewer} />
        ))}
      </div>
    </div>
  );
}
