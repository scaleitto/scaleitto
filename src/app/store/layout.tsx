import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = { title: "Store" };

// Storefronts are per-shop data, rendered per request.
export const instant = false;

// The shop's own language and direction are applied by ./[slug]/layout.tsx.
export default function StoreRootLayout({ children }: LayoutProps<"/store">) {
  return (
    <html lang="ar" className={fontVariables}>
      <body className="min-h-screen bg-s-bg font-sans text-s-text antialiased">{children}</body>
    </html>
  );
}
