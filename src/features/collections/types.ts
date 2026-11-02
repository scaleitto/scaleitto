import type { CollectionTexts } from "@/server/db/schema";

export const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// A collection's title in the store's language, else the first one written
export const textIn = (texts: CollectionTexts, locale: string) => texts[locale as keyof CollectionTexts] || texts.ar || texts.fr || texts.en || "";
