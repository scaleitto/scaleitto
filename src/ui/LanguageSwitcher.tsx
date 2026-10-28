"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";

// Each language in its own name, so anyone finds theirs
const names: Record<Locale, string> = { ar: "العربية", fr: "Français", en: "English" };

// A small dropdown: the current language, and the others on click (same page, other language)
export function LanguageSwitcher({ current }: { current: Locale }) {
  const rest = usePathname().split("/").slice(2).join("/");
  return (
    <details className="group relative" data-testid="lang-switch">
      <summary aria-label={names[current]} className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-[10px] border border-line px-2.5 text-sm font-medium text-fg transition-colors hover:bg-panel-2 [&::-webkit-details-marker]:hidden">
        <Globe size={15} className="text-muted" aria-hidden />
        <span className="hidden sm:inline">{names[current]}</span>
        <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="absolute end-0 top-11 z-50 min-w-36 rounded-xl border border-line bg-panel p-1 shadow-lg">
        {locales.map((l) => (
          <li key={l}>
            <Link
              href={`/${l}/${rest}`}
              lang={l}
              hrefLang={l}
              aria-current={l === current ? "true" : undefined}
              onClick={(e) => {
                document.cookie = `sc_locale=${l};path=/;max-age=31536000`;
                e.currentTarget.closest("details")?.removeAttribute("open");
              }}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${l === current ? "font-semibold text-accent" : "text-fg hover:bg-panel-2"}`}
            >
              {names[l]}
              {l === current && <Check size={15} aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
