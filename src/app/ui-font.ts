import { IBM_Plex_Sans_Arabic } from "next/font/google";

// The interface font of the dashboard, admin, sign-in and homepage (design-system/scaleitto/MASTER.md), the one ayor uses.
// Imported by the [lang] root layout alone, so stores never download it.
export const uiFont = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui", display: "swap" });
