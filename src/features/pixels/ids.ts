// Tag IDs end up inside inline scripts, so each platform's format is checked strictly (client-safe module).
import type { PixelPlatform, PurchaseTrigger } from "@/server/db/schema";

export const tagPatterns: Record<PixelPlatform, RegExp> = {
  meta: /^\d{5,20}$/,
  tiktok: /^[A-Z0-9]{10,30}$/,
  ga4: /^G-[A-Z0-9]{4,15}$/,
  gtm: /^GTM-[A-Z0-9]{4,12}$/,
};

export const normalizeTag = (platform: PixelPlatform, value: string) => (platform === "meta" ? value.trim() : value.trim().toUpperCase());
export const isValidTag = (platform: PixelPlatform, value: string) => tagPatterns[platform].test(value);
// Platforms that can also receive events from the server (with a token / API secret)
export const serverPlatforms: PixelPlatform[] = ["meta", "tiktok", "ga4"];

// What the storefront needs to know about a pixel (never the secret)
export type ClientPixel = { platform: PixelPlatform; id: string; purchaseOn: PurchaseTrigger };
