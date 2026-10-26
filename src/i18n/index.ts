import "server-only";
import ar from "./dictionaries/ar";
import fr from "./dictionaries/fr";
import en from "./dictionaries/en";
import { isLocale, defaultLocale, type Locale } from "./config";

const dictionaries = { ar, fr, en };

export function asLocale(value: string): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function getDictionary(locale: string) {
  return dictionaries[asLocale(locale)];
}

export * from "./config";
export type { Dictionary } from "./dictionaries/ar";
