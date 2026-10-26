"use client";

import { useState, useTransition } from "react";
import { Check, Phone, RotateCcw, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { deleteLead, setLeadStatus } from "./actions";

const iconButton = "rounded-lg p-2 text-muted transition hover:bg-panel-2 hover:text-fg disabled:opacity-50";

export function LeadActions({ lang, id, phone, status, t }: { lang: string; id: string; phone: string; status: "abandoned" | "contacted"; t: Pick<Dictionary, "orders" | "errors" | "common"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const errors = t.errors as Record<string, string>;
  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const r = await fn();
      setError(r.ok ? null : (errors[r.error ?? "unexpected"] ?? errors.unexpected));
    });
  const contacted = status === "contacted";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-0.5">
        <a href={`tel:${phone}`} className={iconButton} title={t.orders.call} aria-label={t.orders.call}>
          <Phone size={16} />
        </a>
        <button
          type="button"
          className={iconButton}
          disabled={pending}
          title={contacted ? t.orders.markAbandoned : t.orders.markContacted}
          aria-label={contacted ? t.orders.markAbandoned : t.orders.markContacted}
          onClick={() => run(() => setLeadStatus(lang, id, contacted ? "abandoned" : "contacted"))}
        >
          {contacted ? <RotateCcw size={16} /> : <Check size={16} />}
        </button>
        <button
          type="button"
          className={`${iconButton} hover:bg-danger/10 hover:text-danger`}
          disabled={pending}
          title={t.common.delete}
          aria-label={t.common.delete}
          onClick={() => {
            if (confirm(t.orders.confirmDeleteLead)) run(() => deleteLead(lang, id));
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
