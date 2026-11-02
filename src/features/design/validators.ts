import { z } from "zod";
import { isValidDzPhone, normalizePhone } from "@/lib/phone";
import { styleChoices } from "./types";

// A theme change chosen from a list, or "" (the theme's own choice)
const choice = <T extends string | number>(list: readonly T[]) => z.preprocess((v) => (list.map(String).includes(String(v)) ? list.find((x) => String(x) === String(v)) : ""), z.union([z.literal(""), z.custom<T>()]));

const text = (max: number) => z.string().trim().max(max, "e:tooLong").optional().default("");
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());
// Our uploads, or an https link
const image = z.string().trim().max(500).regex(/^$|^\/uploads\/[\w-]+\/[\w.-]+$|^https:\/\/\S+$/, "e:invalid").optional().default("");
// A profile link on a given site (https only), or empty
const social = (host: RegExp) =>
  z
    .string()
    .trim()
    .max(300)
    .optional()
    .default("")
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .refine((v) => v === "" || (/^https:\/\//i.test(v) && host.test(new URL(v).hostname)), "e:socialLink");

// The design form (flat field names, as sent by the browser).
export const designSchema = z
  .object({
    primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "e:color"),
    logoUrl: image,
    announcementEnabled: checkbox,
    announcementText: text(160),
    heroEnabled: checkbox,
    heroImage: image,
    heroTitle: text(120),
    heroSubtitle: text(300),
    heroButtonText: text(40),
    productsTitle: text(80),
    showBadges: checkbox,
    showOrderSteps: checkbox,
    styleFont: choice(styleChoices.font),
    styleHeader: choice(styleChoices.header),
    styleHero: choice(styleChoices.hero),
    styleColumns: choice(styleChoices.columns),
    styleImage: choice(styleChoices.image),
    styleCards: choice(styleChoices.cards),
    styleCorners: choice(styleChoices.corners),
    about: text(1000),
    facebook: social(/(^|\.)(facebook\.com|fb\.com)$/i),
    instagram: social(/(^|\.)instagram\.com$/i),
    tiktok: social(/(^|\.)tiktok\.com$/i),
    whatsapp: z
      .string()
      .trim()
      .optional()
      .default("")
      .transform((v) => (v ? normalizePhone(v) : ""))
      .refine((v) => v === "" || isValidDzPhone(v), "e:phone"),
  })
  .superRefine((d, ctx) => {
    if (d.announcementEnabled && !d.announcementText) ctx.addIssue({ code: "custom", path: ["announcementText"], message: "e:required" });
    if (d.heroEnabled && !d.heroTitle && !d.heroImage) ctx.addIssue({ code: "custom", path: ["heroTitle"], message: "e:required" });
  })
  .transform((d) => ({
    primaryColor: d.primaryColor.toLowerCase(),
    logoUrl: d.logoUrl || null,
    design: {
      announcement: { enabled: d.announcementEnabled, text: d.announcementText },
      hero: { enabled: d.heroEnabled, image: d.heroImage, title: d.heroTitle, subtitle: d.heroSubtitle, buttonText: d.heroButtonText },
      productsTitle: d.productsTitle,
      showBadges: d.showBadges,
      showOrderSteps: d.showOrderSteps,
      style: { font: d.styleFont, header: d.styleHeader, hero: d.styleHero, columns: d.styleColumns || 0, image: d.styleImage, cards: d.styleCards, corners: d.styleCorners },
      about: d.about,
      socials: { facebook: d.facebook, instagram: d.instagram, tiktok: d.tiktok, whatsapp: d.whatsapp },
    },
  }));
