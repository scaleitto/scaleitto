import { z } from "zod";

// Messages prefixed with "e:" are keys of the `errors` dictionary.
export const RESERVED_SLUGS = new Set(["www", "app", "admin", "api", "store", "dashboard", "uploads", "ar", "fr", "en", "scaleitto"]);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120),
  email: z.string().trim().toLowerCase().email("e:email").max(191),
  password: z.string().min(8, "e:password").max(200),
  shopName: z.string().trim().min(2, "e:tooShort").max(120),
  shopSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "e:slug")
    .refine((s) => !RESERVED_SLUGS.has(s), "e:slugTaken"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("e:email"),
  password: z.string().min(1, "e:required"),
});
