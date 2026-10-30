import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";

// The interface fonts of the dashboard, admin, sign-in and homepage: Space Grotesk for Latin text and numbers, IBM Plex
// Sans Arabic for Arabic (the browser takes each letter from the first font that has it).
// Imported by the [lang] root layout alone, so stores never download them.
export const uiFont = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui", display: "swap" });
export const uiFontAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-ui-ar", display: "swap" });
