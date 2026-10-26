import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { notFound } from "next/navigation";
import { dir, isLocale, locales } from "@/i18n/config";
import "../globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: "Scaleitto",
  description: "Algerian e-commerce platform",
};

// Most pages read the session or the database, so they render per request.
export const instant = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} dir={dir(lang)} className={cairo.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
