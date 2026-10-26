import { z } from "zod";
import type { LandingSection } from "@/db/schema";

const url = z.string().trim().max(500).regex(/^https?:\/\//);
const optionalUrl = z.union([z.literal(""), url]).optional();
const short = z.string().trim().max(200);
const long = z.string().trim().max(5000);

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), title: short.min(1), subtitle: short.optional(), image: optionalUrl, badge: z.string().trim().max(60).optional() }),
  z.object({ type: z.literal("badges"), items: z.array(z.string().trim().min(1).max(60)).min(1).max(6) }),
  z.object({ type: z.literal("steps"), title: short.optional(), items: z.array(short.min(1)).min(1).max(8) }),
  z.object({ type: z.literal("cta"), title: short.min(1), subtitle: short.optional() }),
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

export const sectionTypes = ["hero", "badges", "text", "image", "features", "steps", "testimonials", "faq", "cta"] as const satisfies readonly LandingSection["type"][];

const LIMITS: Record<string, number> = { title: 200, subtitle: 200, badge: 60, body: 5000, url: 500, image: 500, name: 200, q: 200, a: 5000, text: 5000 };

function trimDeep(value: unknown, key = "", inBadges = false): unknown {
  if (typeof value === "string") return value.trim().slice(0, inBadges ? 60 : (LIMITS[key] ?? 200));
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => trimDeep(v, key, inBadges));
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, trimDeep(v, k, o.type === "badges" || inBadges)]));
  }
  return value;
}

// Never fails a whole save because of one section: long texts are shortened and
// sections that are still invalid (empty, broken image link…) are dropped.
export function sanitizeSections(raw: unknown): LandingSection[] {
  if (!Array.isArray(raw)) return [];
  const out: LandingSection[] = [];
  for (const s of raw.slice(0, 30)) {
    const section = trimDeep(s) as Record<string, unknown>;
    if (section?.type === "badges" && Array.isArray(section.items)) section.items = section.items.slice(0, 6);
    if (section?.type === "steps" && Array.isArray(section.items)) section.items = section.items.slice(0, 8);
    const parsed = sectionSchema.safeParse(section);
    if (parsed.success) out.push(parsed.data as LandingSection);
  }
  return out;
}
