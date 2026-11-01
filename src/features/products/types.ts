import { productStatuses } from "@/server/db/schema";

export type ProductStatus = (typeof productStatuses)[number];

// What the edit form works with (also the shape sent back to the server as JSON).
export type VariantDraft = { title: string; values: Record<string, string>; sku: string; price: number | null; stock: number };
