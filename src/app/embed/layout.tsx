import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

// Landing page order forms embedded on other websites (iframe): no header, no footer.
export const instant = false;

export default function EmbedRootLayout({ children }: LayoutProps<"/embed">) {
  return (
    <html lang="ar" className={fontVariables}>
      <body className="bg-transparent font-sans text-s-text antialiased">{children}</body>
    </html>
  );
}
