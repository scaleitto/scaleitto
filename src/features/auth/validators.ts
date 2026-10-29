import { z } from "zod";
import { locales } from "@/i18n/config";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";

// Messages prefixed with "e:" are keys of the `errors` dictionary.
export const RESERVED_SLUGS = new Set(["www", "app", "admin", "api", "store", "dashboard", "uploads", "ar", "fr", "en", "scaleitto"]);

// A shop's link (also its subdomain): shared by sign-up and the settings
export const shopSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "e:slug")
  .refine((s) => !RESERVED_SLUGS.has(s), "e:slugTaken");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120),
  email: z.string().trim().toLowerCase().email("e:email").max(191),
  // The owner's mobile (required: the platform calls merchants about their account and payments)
  phone: z
    .string()
    .transform((v) => normalizePhone(v))
    .refine(isValidDzPhone, "e:phone"),
  password: z.string().min(8, "e:password").max(200),
  shopName: z.string().trim().min(2, "e:tooShort").max(120),
  shopSlug: shopSlugSchema,
  // The language the store is built in (its texts and its customers' pages)
  storeLanguage: z.enum(locales, { error: "e:invalid" }),
});

export const emailSchema = z.object({ email: z.string().trim().toLowerCase().email("e:email").max(191) });
export const newPasswordSchema = z.object({ password: z.string().min(8, "e:password").max(200) });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("e:email"),
  password: z.string().min(1, "e:required"),
});
