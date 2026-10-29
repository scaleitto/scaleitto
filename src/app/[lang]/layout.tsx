import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import { uiFont } from "../ui-font";
import { notFound } from "next/navigation";
import { dir, isLocale, locales } from "@/i18n/config";
import "../globals.css";

export const metadata: Metadata = { title: "Scaleitto", description: "Store, AI landing pages, cash-on-delivery orders, call center and delivery in one platform" };

// Almost every page reads the session or the database, so pages render per request.
export const instant = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} dir={dir(lang)} className={`${fontVariables} ${uiFont.variable} bg-bg`}>
      <body className="min-h-screen bg-bg font-sans text-fg">{children}</body>
    </html>
  );
}
