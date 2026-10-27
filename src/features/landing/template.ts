import { getStoreText } from "@/i18n/store";
import { interfaceLocale, newSectionId, type LandingSection, type PageLanguage } from "./types";

type ProductInfo = { name: string; description: string | null; images: string[]; compareAtPrice: number | null; price: number };

// A ready-to-edit page built from the product's own data (used when creating a page by hand).
export function starterSections(product: ProductInfo, language: PageLanguage): LandingSection[] {
  const t = getStoreText(interfaceLocale(language)).landing;
  const [main, ...more] = product.images;
  const off = product.compareAtPrice && product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const description = product.description?.trim() ?? "";
  const sections: LandingSection[] = [
    { id: newSectionId(), type: "hero", title: product.name, subtitle: description.split("\n")[0]?.slice(0, 300) || undefined, image: main, badge: off ? `-${off}%` : undefined },
    { id: newSectionId(), type: "badges", items: t.defaults.badges },
    { id: newSectionId(), type: "form" },
  ];
  if (description) sections.push({ id: newSectionId(), type: "text", body: description });
  if (more.length) sections.push({ id: newSectionId(), type: "gallery", images: more.slice(0, 12) });
  sections.push({ id: newSectionId(), type: "steps", items: t.defaults.steps }, { id: newSectionId(), type: "cta", title: t.defaults.cta });
  return sections;
}
