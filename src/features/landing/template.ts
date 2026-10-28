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

// An image page (Wibi style) made by hand: the band of selling points, then images to design (with the AI
// in the editor) or to replace with the merchant's own designed images, in the persuasion sequence, then the form.
export function starterImageSections(product: ProductInfo, language: PageLanguage): LandingSection[] {
  const t = getStoreText(interfaceLocale(language)).landing;
  const poster = (kind: Extract<LandingSection, { type: "poster" }>["kind"], headline: string): LandingSection => ({ id: newSectionId(), type: "poster", image: "", kind, headline, bullets: [], previous: [] });
  return [
    { id: newSectionId(), type: "marquee", items: t.defaults.badges },
    poster("hero", product.name),
    poster("problem", t.defaults.posters.problem),
    poster("solution", t.defaults.posters.solution),
    poster("benefits", t.defaults.posters.benefits),
    poster("features", t.defaults.posters.features),
    poster("howto", t.defaults.posters.howto),
    poster("offer", t.defaults.posters.offer),
    { id: newSectionId(), type: "form" },
  ];
}
