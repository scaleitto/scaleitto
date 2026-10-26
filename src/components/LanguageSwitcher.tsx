"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/");
  return (
    <div className="flex gap-1 text-xs">
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}/${rest}`}
          onClick={() => {
            document.cookie = `sc_locale=${l};path=/;max-age=31536000`;
          }}
          className={`rounded px-2 py-1 ${l === current ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {localeNames[l]}
        </Link>
      ))}
    </div>
  );
}
