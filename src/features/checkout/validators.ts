import { z } from "zod";
import { deliveryTypes } from "@/server/db/schema";
import { wilayas } from "@/lib/wilayas";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { MAX_QUANTITY } from "./pricing";

// The customer's order form. Messages are keys of the storefront strings (errors.*).
export const orderInputSchema = z.object({
  name: z.string().trim().min(2, "e:name").max(120, "e:name"),
  phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine(isValidDzPhone, "e:phone"),
  wilaya: z.coerce.number().int().refine((c) => wilayas.some((w) => w.code === c), "e:wilaya"),
  commune: z.string().trim().min(2, "e:commune").max(120, "e:commune"),
  address: z.string().trim().max(255).optional().default(""),
  deliveryType: z.enum(deliveryTypes, { error: "e:deliveryType" }),
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY),
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
