import { brandVars, type Theme } from "@/features/themes/themes";
import type { ReactNode } from "react";
import { dir } from "@/i18n/config";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { wilayas } from "@/lib/wilayas";
import type { RateMap } from "@/features/checkout/pricing";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import type { ActionState } from "@/lib/action";
import { LandingSections, isImagePage } from "./blocks";
import { PriceTag } from "./PriceTag";
import { interfaceLocale, resolveForm, sanitizeSections, type PageLanguage, pageLanguages } from "./types";

type Product = Parameters<typeof CheckoutForm>[0]["product"] & { compareAtPrice: number | null };
type Variant = Parameters<typeof CheckoutForm>[0]["variants"][number];
export type LandingRow = { id: string; language: string; color: string | null; sections: unknown; form: unknown };

export const pageLanguage = (v: string): PageLanguage => (pageLanguages.includes(v as PageLanguage) ? (v as PageLanguage) : "ar");

// A landing page in its own language and color, with its configured order form.
export function PublicLanding({
  page,
  product,
  variants,
  rates,
  action,
  saveLead,
  embedded = false,
  theme,
  children,
}: {
  page: LandingRow;
  product: Product;
  variants: Variant[];
  rates: RateMap;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  saveLead: Parameters<typeof CheckoutForm>[0]["saveLead"];
  embedded?: boolean;
  // The store's theme, so the page's own color gets readable text on and around it
  theme: Theme;
  children?: ReactNode;
}) {
  const locale = interfaceLocale(pageLanguage(page.language));
  const t = getStoreText(locale);
  const currency = currencyLabel(locale);
  const form = (
    <CheckoutForm
      t={t}
      currency={currency}
      product={product}
      variants={variants}
      rates={rates}
      wilayas={wilayas.map((w) => ({ code: w.code, name: `${String(w.code).padStart(2, "0")} - ${locale === "ar" ? w.ar : w.fr}` }))}
      action={action}
      saveLead={saveLead}
      settings={resolveForm(page.form)}
      embedded={embedded}
    />
  );
  const sections = sanitizeSections(page.sections);
  return (
    // Image pages reach the screen edges on phones
    <div lang={locale} dir={dir(locale)} style={page.color ? brandVars(page.color, theme) : undefined} className={`pb-20 md:pb-0 ${!embedded && isImagePage(sections) ? "-mx-4 -mt-6 sm:mx-0 sm:mt-0" : ""}`}>
      {embedded ? form : <LandingSections sections={sections} form={form} t={t} price={<PriceTag price={product.price} compareAtPrice={product.compareAtPrice} currency={currency} />} />}
      {children}
    </div>
  );
}
