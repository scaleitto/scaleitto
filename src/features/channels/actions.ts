"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { newId, requireSection } from "@/server/auth/context";
import { encryptJson } from "@/server/crypto";
import { safeAction } from "@/server/errors";
import { asLocale } from "@/i18n";
import { fieldErrorsFrom } from "@/lib/validation";
import type { ActionState } from "@/lib/action";
import { channelKinds, type ChannelKind } from "@/server/db/schema";

const guard = (lang: string) => requireSection(asLocale(lang), "channels");

// Shopify: the store's *.myshopify.com address and the signing key Shopify shows under Settings → Notifications →
// Webhooks. WooCommerce: the store's https address; the signing secret is made here and pasted into WooCommerce.
const shopifySchema = z.object({
  storeUrl: z.string().trim().toLowerCase().transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, "")).refine((v) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(v), "e:shopifyDomain"),
  secret: z.string().trim().min(16, "e:tooShort").max(200, "e:invalid"),
});
const wooSchema = z.object({
  storeUrl: z.string().trim().max(255).refine((v) => /^https:\/\/[^\s/]+\.[^\s/]+/.test(v), "e:httpsUrl").transform((v) => v.replace(/\/+$/, "")),
});

export async function connectChannel(lang: string, kind: ChannelKind, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return safeAction("channels/connect", async () => {
    const { shop } = await guard(lang);
    if (!(channelKinds as readonly string[]).includes(kind)) return { ok: false, error: "invalid" };
    const raw = Object.fromEntries(formData);
    let storeUrl: string;
    let secret: string;
    if (kind === "shopify") {
      const parsed = shopifySchema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
      ({ storeUrl, secret } = parsed.data);
    } else {
      const parsed = wooSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: "checkFields", fieldErrors: fieldErrorsFrom(parsed.error) };
      storeUrl = parsed.data.storeUrl;
      secret = randomBytes(24).toString("base64url");
    }
    const [existing] = await db.select({ id: schema.shopChannels.id }).from(schema.shopChannels).where(and(eq(schema.shopChannels.shopId, shop.id), eq(schema.shopChannels.kind, kind)));
    if (existing) await db.update(schema.shopChannels).set({ storeUrl, secret: encryptJson({ secret }), active: true }).where(eq(schema.shopChannels.id, existing.id));
    else await db.insert(schema.shopChannels).values({ id: newId(), shopId: shop.id, kind, token: randomBytes(18).toString("base64url"), secret: encryptJson({ secret }), storeUrl });
    refresh();
    return { ok: true };
  });
}

export async function setChannelActive(lang: string, kind: ChannelKind, active: boolean): Promise<ActionState> {
  return safeAction("channels/active", async () => {
    const { shop } = await guard(lang);
    await db.update(schema.shopChannels).set({ active }).where(and(eq(schema.shopChannels.shopId, shop.id), eq(schema.shopChannels.kind, kind)));
    refresh();
    return { ok: true };
  });
}

export async function disconnectChannel(lang: string, kind: ChannelKind): Promise<ActionState> {
  return safeAction("channels/disconnect", async () => {
    const { shop } = await guard(lang);
    await db.delete(schema.shopChannels).where(and(eq(schema.shopChannels.shopId, shop.id), eq(schema.shopChannels.kind, kind)));
    refresh();
    return { ok: true };
  });
}
