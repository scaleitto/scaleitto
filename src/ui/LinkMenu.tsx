"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

// Zimam's small dropdown (overview periods, chart range): a button showing the current choice, a list of links with
// the current one filled and checked. Closes on a click outside, Escape or a choice.
export function LinkMenu({ icon, label, items, testId, itemAttr = "data-value" }: { icon?: ReactNode; label: string; items: { key: string; href: string; label: string; current: boolean }[]; testId?: string; itemAttr?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-sm font-semibold shadow-sm hover:bg-panel-2"
        data-testid={testId}
      >
        {icon}
        {label}
        <ChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-11 z-30 min-w-40 rounded-xl border border-line bg-panel p-1 shadow-lift">
          {items.map((it) => (
            <Link
              key={it.key}
              href={it.href}
              role="menuitemradio"
              aria-checked={it.current}
              onClick={() => setOpen(false)}
              scroll={false}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${it.current ? "bg-accent font-semibold text-white" : "hover:bg-panel-2"}`}
              {...{ [itemAttr]: it.key }}
            >
              {it.label}
              {it.current && <Check size={15} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
