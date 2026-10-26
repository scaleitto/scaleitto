"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";

const short: Record<Locale, string> = { ar: "ع", fr: "FR", en: "EN" };

export function LanguageSwitcher({ current }: { current: Locale }) {
  const rest = usePathname().split("/").slice(2).join("/");
  return (
    <div className="flex rounded-lg border border-line p-0.5 text-xs">
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}/${rest}`}
          onClick={() => {
            document.cookie = `sc_locale=${l};path=/;max-age=31536000`;
          }}
          className={`rounded-md px-2 py-1 font-semibold ${l === current ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}
        >
          {short[l]}
        </Link>
      ))}
    </div>
  );
}
