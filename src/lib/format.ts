import { TIME_ZONE } from "./time";

export function formatPrice(amount: number, currencyLabel: string) {
  return `${amount.toLocaleString("fr-FR")} ${currencyLabel}`;
}

const intlLocale = (locale: string) => (locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB");

// Always shown in Algeria time, whatever the server's own time zone is.
export function formatDate(d: Date, locale: string) {
  return d.toLocaleString(intlLocale(locale), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
}

export function formatTime(d: Date, locale: string) {
  return d.toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

// 135 → "2 h 15 min" with the dictionary's patterns
export function formatDuration(minutes: number, t: { minutes: string; hours: string }) {
  return minutes < 60 ? fmt(t.minutes, { n: minutes }) : fmt(t.hours, { h: Math.floor(minutes / 60), m: minutes % 60 });
}

export function slugify(input: string) {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || "product";
}

// "{n} variants" + { n: 3 } → "3 variants"
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}
