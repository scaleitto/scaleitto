import { Almarai, Cairo, Changa, El_Messiri, IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic, Readex_Pro, Tajawal } from "next/font/google";

// Fonts for the dashboard and the store themes. Each one is only downloaded by a browser
// when a page actually uses it.
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal", preload: false });
const almarai = Almarai({ subsets: ["arabic"], weight: ["400", "700", "800"], variable: "--font-almarai", preload: false });
const changa = Changa({ subsets: ["arabic", "latin"], variable: "--font-changa", preload: false });
const elMessiri = El_Messiri({ subsets: ["arabic", "latin"], variable: "--font-el-messiri", preload: false });
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", preload: false });
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic"], variable: "--font-kufi", preload: false });
const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex", preload: false });

export const fontVariables = [cairo, tajawal, almarai, changa, elMessiri, plex, kufi, readex].map((f) => f.variable).join(" ");
