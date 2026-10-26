import { z } from "zod";
import type { LandingSection } from "@/db/schema";

const url = z.string().trim().max(500).regex(/^https?:\/\//);
const optionalUrl = z.union([z.literal(""), url]).optional();
const short = z.string().trim().max(200);
const long = z.string().trim().max(5000);

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), title: short.min(1), subtitle: short.optional(), image: optionalUrl }),
  z.object({ type: z.literal("text"), title: short.optional(), body: long.min(1) }),
  z.object({ type: z.literal("image"), url }),
  z.object({ type: z.literal("features"), title: short.optional(), items: z.array(short.min(1)).min(1).max(20) }),
  z.object({
    type: z.literal("testimonials"),
    title: short.optional(),
    items: z.array(z.object({ name: short.min(1), text: long.min(1) })).min(1).max(20),
  }),
  z.object({
    type: z.literal("faq"),
    title: short.optional(),
    items: z.array(z.object({ q: short.min(1), a: long.min(1) })).min(1).max(20),
  }),
]);

export const sectionsSchema = z.array(sectionSchema).max(30);

export const sectionTypes = ["hero", "text", "image", "features", "testimonials", "faq"] as const satisfies readonly LandingSection["type"][];
