import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ProductFormText } from "./ProductForm";

// Only the strings the product screens need are sent to the browser.
export const productFormText = (t: Dictionary): ProductFormText => ({ products: t.products, media: t.media, errors: t.errors, common: t.common });
