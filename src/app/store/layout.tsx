import { Cairo } from "next/font/google";
import "../globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

// Storefronts are per-shop data, rendered per request.
export const instant = false;

// The shop's own language and direction are applied by ./[slug]/layout.tsx.
export default function StoreRootLayout({ children }: LayoutProps<"/store">) {
  return (
    <html lang="ar" className={cairo.variable}>
      <body className="min-h-screen bg-white font-sans">{children}</body>
    </html>
  );
}
