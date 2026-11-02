"use client";

import type { ReactNode } from "react";

// A setting with a switch on its row (Zimam's "Enable …" rows). The checkbox covers the whole row, so a click anywhere
// on it toggles (also right-to-left). Controlled when `checked` is given, otherwise a plain form field named `name`.
export function SwitchRow({ name, label, hint, icon, checked, defaultChecked, onChange, testId, disabled = false }: { name?: string; label: ReactNode; hint?: ReactNode; icon?: ReactNode; checked?: boolean; defaultChecked?: boolean; onChange?: (v: boolean) => void; testId?: string; disabled?: boolean }) {
  return (
    <label className={`relative flex items-center gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      {icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-fg-2">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange ? (ev) => onChange(ev.target.checked) : undefined}
        className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        data-testid={testId}
      />
      <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:start-[1.375rem]" />
    </label>
  );
}
