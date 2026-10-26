export function formatPrice(amount: number, currencyLabel: string) {
  return `${amount.toLocaleString("fr-FR")} ${currencyLabel}`;
}

export function formatDate(d: Date, locale: string) {
  return d.toLocaleString(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
