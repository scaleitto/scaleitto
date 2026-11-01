import { z } from "zod";
import { offerBadges, productStatuses } from "@/server/db/schema";
import { slugify } from "@/lib/format";
import { combinations } from "./variants";
import { MAX_IMAGES, MAX_OFFERS, MAX_OPTIONS, MAX_VARIANTS } from "./constants";

// "4 500", "4,500" and "4500" are all 4500 DZD. Empty → null.
const money = (message: string) =>
  z.preprocess(
    (v) => {
      const s = String(v ?? "").replace(/[\s,. ]/g, "");
      return s === "" ? null : Number(s);
    },
    z.number({ error: message }).int(message).min(0, message).max(100_000_000, message).nullable(),
  );

// A JSON field of the form (options, variants…): any problem becomes one message for that field.
const json = <T extends z.ZodType>(inner: T, message: string) =>
  z
    .string()
    .optional()
    .transform((raw, ctx): z.output<T> => {
      try {
        const parsed = inner.safeParse(JSON.parse(raw || "[]"));
        if (parsed.success) return parsed.data;
      } catch {
        // falls through to the field error
      }
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    });

const imagePath = z.string().regex(/^(\/uploads\/[\w-]+\/[\w.-]+|https:\/\/\S+)$/);

const optionSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    values: z.array(z.string().trim().min(1).max(40)).min(1).max(30),
    kind: z.literal("color").optional(),
    colors: z.record(z.string(), z.string().regex(/^#[0-9a-f]{6}$/i)).optional(),
  })
  // Only color options keep colors, and only for their own values
  .transform(({ kind, colors, ...o }) =>
    kind === "color" ? { ...o, kind, colors: Object.fromEntries(Object.entries(colors ?? {}).filter(([v]) => o.values.includes(v))) } : o,
  );

const variantSchema = z.object({
  title: z.string(),
  sku: z.string().trim().max(80).optional().default(""),
  price: z.number().int().min(0).max(100_000_000).nullable().optional().default(null),
  stock: z.number().int().min(0).max(1_000_000).optional().default(0),
});

const offerSchema = z.object({
  quantity: z.number().int().min(2).max(100),
  price: z.number().int().min(1).max(100_000_000),
  label: z.string().trim().max(60).optional(),
  freeShipping: z.boolean().optional(),
  gift: z.string().trim().max(80).optional(),
  badge: z.enum(offerBadges).optional(),
  preselected: z.boolean().optional(),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "e:tooShort").max(200, "e:invalid"),
    slug: z.string().trim().max(120).optional().default(""),
    description: z.string().trim().max(20_000, "e:invalid").optional().default(""),
    // At most 7 words (Zimam's short description)
    shortDescription: z
      .string()
      .trim()
      .max(120, "e:invalid")
      .optional()
      .default("")
      .refine((v) => v.split(/\s+/).filter(Boolean).length <= 7, "e:shortDescription"),
    price: money("e:price").refine((v) => v !== null, "e:price"),
    compareAtPrice: money("e:price"),
    costPrice: money("e:price"),
    sku: z.string().trim().max(80, "e:invalid").optional().default(""),
    trackStock: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    stock: money("e:stock").transform((v) => v ?? 0),
    status: z.enum(productStatuses),
    images: json(z.array(imagePath).max(MAX_IMAGES), "e:images"),
    descriptionImages: json(z.array(imagePath).max(MAX_IMAGES), "e:images"),
    lowStock: money("e:stock"),
    showOutOfStock: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    carrierAccountId: z.string().optional().default(""),
    // "auto" = the store's other products; otherwise the chosen ones
    similar: z.enum(["auto", "chosen"]).optional().default("auto"),
    similarIds: json(z.array(z.string().uuid()).max(50), "e:invalid"),
    options: json(
      z
        .array(optionSchema)
        .max(MAX_OPTIONS)
        .refine((opts) => new Set(opts.map((o) => o.name.toLowerCase())).size === opts.length)
        .refine((opts) => opts.every((o) => new Set(o.values.map((v) => v.toLowerCase())).size === o.values.length))
        .refine((opts) => combinations(opts).length <= MAX_VARIANTS),
      "e:options",
    ),
    variants: json(z.array(variantSchema).max(MAX_VARIANTS), "e:variants"),
    offers: json(
      z
        .array(offerSchema)
        .max(MAX_OFFERS)
        .refine((offers) => new Set(offers.map((o) => o.quantity)).size === offers.length)
        .refine((offers) => offers.filter((o) => o.preselected).length <= 1),
      "e:offers",
    ),
  })
  .superRefine((p, ctx) => {
    if (p.compareAtPrice !== null && p.price !== null && p.compareAtPrice <= p.price) ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "e:compareAtPrice" });
  })
  .transform((p) => ({ ...p, price: p.price as number, slug: slugify(p.slug || p.name) }));

export type ProductInput = z.output<typeof productSchema>;
