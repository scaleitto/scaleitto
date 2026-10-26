"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { deleteProduct, duplicateProduct, setProductsStatus } from "./actions";
import type { ProductStatus } from "./types";

const iconButton = "rounded-lg p-2 text-muted transition hover:bg-panel-2 hover:text-fg disabled:opacity-50";

// Edit / show-hide / duplicate / delete buttons for one product row.
export function ProductActions({ lang, id, status, editHref, t }: { lang: string; id: string; status: ProductStatus; editHref: string; t: Pick<Dictionary, "products" | "errors" | "common"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const errors = t.errors as Record<string, string>;

  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(errors[result.error ?? "unexpected"] ?? errors.unexpected);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-0.5">
      <Link href={editHref} className={iconButton} title={t.common.edit} aria-label={t.common.edit}>
        <Pencil size={16} />
      </Link>
      <button
        type="button"
        className={iconButton}
        disabled={pending}
        title={status === "active" ? t.products.deactivate : t.products.activate}
        aria-label={status === "active" ? t.products.deactivate : t.products.activate}
        onClick={() => run(() => setProductsStatus(lang, [id], status === "active" ? "draft" : "active"))}
      >
        {status === "active" ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <button type="button" className={iconButton} disabled={pending} title={t.products.duplicate} aria-label={t.products.duplicate} onClick={() => run(() => duplicateProduct(lang, id))}>
        <Copy size={16} />
      </button>
      <button
        type="button"
        className={`${iconButton} hover:bg-danger/10 hover:text-danger`}
        disabled={pending}
        title={t.common.delete}
        aria-label={t.common.delete}
        onClick={() => {
          if (confirm(t.products.confirmDelete)) run(() => deleteProduct(lang, id));
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
