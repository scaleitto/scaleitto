"use client";

import { useState } from "react";
import { CircleCheckBig, X } from "lucide-react";

// The page's thank-you window, shown when the visitor comes back to the page after ordering
export function ThankYouPopup({ title, message, number, close, children }: { title: string; message: string; number: string; close: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return <>{children}</>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title} data-testid="thank-you-popup">
      <div className="relative w-full max-w-sm space-y-3 rounded-[var(--s-radius)] bg-s-surface p-6 text-center shadow-2xl">
        <button type="button" onClick={() => setOpen(false)} aria-label={close} className="absolute end-3 top-3 grid size-8 place-items-center rounded-full text-s-muted hover:bg-black/5">
          <X size={18} />
        </button>
        <CircleCheckBig size={52} className="mx-auto text-brand-ink" aria-hidden />
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="leading-relaxed whitespace-pre-line text-s-muted">{message}</p>
        <p className="text-sm font-bold">{number}</p>
        <button type="button" onClick={() => setOpen(false)} className="w-full rounded-[var(--s-radius-btn)] bg-brand py-3 font-bold text-brand-fg">
          {close}
        </button>
      </div>
      {children}
    </div>
  );
}
