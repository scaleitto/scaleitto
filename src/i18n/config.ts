export const locales = ["ar", "fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export const localeNames: Record<Locale, string> = { ar: "العربية", fr: "Français", en: "English" };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function dir(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}
