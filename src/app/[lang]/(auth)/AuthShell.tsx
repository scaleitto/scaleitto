import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AuthShell({
  lang,
  brand,
  title,
  error,
  children,
}: {
  lang: Locale;
  brand: string;
  title: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-4 py-10">
      <Link href={`/${lang}`} className="mb-6 text-3xl font-extrabold text-brand">
        {brand}
      </Link>
      <div className="card w-full max-w-md">
        <h1 className="mb-5 text-xl font-bold">{title}</h1>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {children}
      </div>
      <div className="mt-6">
        <LanguageSwitcher current={lang} />
      </div>
    </div>
  );
}
