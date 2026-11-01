import type { ReactNode } from "react";
import { brandVars, type Theme } from "@/features/themes/themes";
import { dir } from "@/i18n/config";
import { currencyLabel, getStoreText } from "@/i18n/store";
import { wilayas } from "@/lib/wilayas";
import type { RateMap } from "@/features/checkout/pricing";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import type { ActionState } from "@/lib/action";
import { LandingSections } from "./blocks";
import { interfaceLocale, pageLanguage, type FormSettings, type LandingSection } from "./types";

type Product = Parameters<typeof CheckoutForm>[0]["product"];
type Variant = Parameters<typeof CheckoutForm>[0]["variants"][number];

// A landing page (the version the visitor was given) in its own language and color, with its order form (formFor:
// the page's template, the product's or the store's). The sticky order button is the page's own component.
export function PublicLanding({
  language,
  color,
  sections,
  settings,
  product,
  variants,
  rates,
  action,
  saveLead,
  embedded = false,
  whatsapp,
  theme,
  children,
}: {
  language: string;
  color: string | null;
  sections: LandingSection[];
  settings: FormSettings;
  product: Product;
  variants: Variant[];
  rates: RateMap;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  saveLead: Parameters<typeof CheckoutForm>[0]["saveLead"];
  embedded?: boolean;
  whatsapp?: Parameters<typeof CheckoutForm>[0]["whatsapp"];
  // The store's theme, so the page's own color gets readable text on and around it
  theme: Theme;
  children?: ReactNode;
}) {
  const locale = interfaceLocale(pageLanguage(language));
  const t = getStoreText(locale);
  const form = (
    <CheckoutForm
      t={t}
      currency={currencyLabel(locale)}
      product={product}
      variants={variants}
      rates={rates}
      wilayas={wilayas.map((w) => ({ code: w.code, name: `${String(w.code).padStart(2, "0")} - ${locale === "ar" ? w.ar : w.fr}` }))}
      action={action}
      saveLead={saveLead}
      settings={{ ...settings, stickyButton: false }}
      embedded={embedded}
      whatsapp={whatsapp}
    />
  );
  return (
    // The page reaches the screen edges on phones
    <div lang={locale} dir={dir(locale)} style={color ? brandVars(color, theme) : undefined} className={embedded ? "" : "-mx-4 -mt-6 sm:mx-0 sm:mt-0"}>
      {embedded ? form : <LandingSections sections={sections} form={form} t={t} />}
      {children}
    </div>
  );
}
