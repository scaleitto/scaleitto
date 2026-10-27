"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { deleteLandingPage, duplicateLandingPage } from "./actions";

const iconButton = "rounded-lg p-2 text-muted transition hover:bg-panel-2 hover:text-fg disabled:opacity-50";

export function PageActions({ lang, id, editHref, viewHref, t }: { lang: string; id: string; editHref: string; viewHref: string | null; t: Pick<Dictionary, "landingPages" | "errors" | "common"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const r = await fn();
      const e = t.errors as Record<string, string>;
      setError(r.ok ? null : (e[r.error ?? "unexpected"] ?? e.unexpected));
    });
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-0.5">
        <Link href={editHref} className={iconButton} title={t.common.edit} aria-label={t.common.edit}>
          <Pencil size={16} />
        </Link>
        {viewHref && (
          <a href={viewHref} target="_blank" rel="noreferrer" className={iconButton} title={t.landingPages.view} aria-label={t.landingPages.view}>
            <ExternalLink size={16} />
          </a>
        )}
        <button type="button" className={iconButton} disabled={pending} title={t.landingPages.duplicate} aria-label={t.landingPages.duplicate} onClick={() => run(() => duplicateLandingPage(lang, id))}>
          <Copy size={16} />
        </button>
        <button
          type="button"
          className={`${iconButton} hover:bg-danger/10 hover:text-danger`}
          disabled={pending}
          title={t.common.delete}
          aria-label={t.common.delete}
          onClick={() => {
            if (confirm(t.landingPages.confirmDelete)) run(() => deleteLandingPage(lang, id));
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {error && <p className="max-w-xs text-xs text-danger">{error}</p>}
    </div>
  );
}
