"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { deleteProduct } from "./actions";

const square = "flex size-9 items-center justify-center rounded-lg border bg-panel transition disabled:opacity-50";

// Zimam's three row buttons: open in the store, edit, delete.
export function ProductActions({ lang, id, storeHref, editHref, t }: { lang: string; id: string; storeHref: string; editHref: string; t: Pick<Dictionary, "products" | "errors" | "common"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const errors = t.errors as Record<string, string>;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <a href={storeHref} target="_blank" rel="noreferrer" className={`${square} border-accent/30 text-accent hover:bg-accent/10`} title={t.products.viewInStore} aria-label={t.products.viewInStore}>
          <ExternalLink size={16} />
        </a>
        <Link href={editHref} className={`${square} border-accent/30 text-accent hover:bg-accent/10`} title={t.common.edit} aria-label={t.common.edit}>
          <Pencil size={16} />
        </Link>
        <button
          type="button"
          className={`${square} border-danger/30 text-danger hover:bg-danger/10`}
          disabled={pending}
          title={t.common.delete}
          aria-label={t.common.delete}
          onClick={() => {
            if (!confirm(t.products.confirmDelete)) return;
            startTransition(async () => {
              setError(null);
              const result = await deleteProduct(lang, id);
              if (!result.ok) setError(errors[result.error ?? "unexpected"] ?? errors.unexpected);
            });
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
