import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "../globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = { title: "Store" };

// Storefronts are per-shop data, rendered per request.
export const instant = false;

// The shop's own language and direction are applied by ./[slug]/layout.tsx.
export default function StoreRootLayout({ children }: LayoutProps<"/store">) {
  return (
    <html lang="ar" className={cairo.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
