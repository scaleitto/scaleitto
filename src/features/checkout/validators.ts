import { z } from "zod";
import { deliveryTypes } from "@/server/db/schema";
import { wilayas } from "@/lib/wilayas";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { WHOLESALE_MAX_QUANTITY } from "./pricing";

// The customer's order form. Messages are keys of the storefront strings (errors.*).
export const orderInputSchema = z.object({
  // Required or not depends on the store's checkout settings (checkContact)
  name: z.string().trim().max(120, "e:name").optional().default(""),
  phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine(isValidDzPhone, "e:phone"),
  // 0 = not given (allowed when the store makes the wilaya optional, checkContact)
  wilaya: z.preprocess((v) => (v === "" || v === undefined || v === null ? 0 : v), z.coerce.number().int().refine((c) => c === 0 || wilayas.some((w) => w.code === c), "e:wilaya")),
  commune: z.string().trim().max(120, "e:commune").optional().default(""),
  address: z.string().trim().max(255).optional().default(""),
  deliveryType: z.enum(deliveryTypes, { error: "e:deliveryType" }),
  quantity: z.coerce.number().int().min(1).max(WHOLESALE_MAX_QUANTITY),
  variantId: z.string().max(36).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  // Honeypot: hidden from people, bots fill it
  website: z.string().optional().default(""),
  // Seconds spent on the form, written by the browser when it is sent (missing: no JavaScript → robot signal)
  fill: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{1,6}$/.test(v) ? Number(v) : null)),
});

export type OrderInput = z.output<typeof orderInputSchema>;

// Store settings → Checkout: a hidden field is dropped, an optional one may stay empty, a required one must be filled.
// Adds the errors to `errors` and returns the values to save.
export function checkContact(rules: { name: "hidden" | "optional" | "required"; commune: "hidden" | "optional" | "required"; wilaya?: "optional" | "required" }, input: { name: string; commune: string; wilaya?: number }, errors: Record<string, string>) {
  if ((rules.wilaya ?? "required") === "required" && !input.wilaya) errors.wilaya = "wilaya";
  const one = (key: "name" | "commune") => {
    const rule = rules[key];
    const value = rule === "hidden" ? "" : input[key];
    if ((rule === "required" && value.length < 2) || (value.length === 1)) errors[key] = key;
    return value;
  };
  return { name: one("name"), commune: one("commune") };
}
