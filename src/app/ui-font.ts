import { IBM_Plex_Sans_Arabic } from "next/font/google";

// The interface font of the dashboard, admin, sign-in and homepage (design-system/scaleitto/MASTER.md).
// Preloaded only where it is used: this file is imported by the [lang] root layout alone.
export const uiFont = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "600", "700"], variable: "--font-ui", display: "swap" });
