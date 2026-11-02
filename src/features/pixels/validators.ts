import { z } from "zod";
import { purchaseTriggers, type PixelPlatform } from "@/server/db/schema";
import { isValidTag, multiAccount, normalizeTag } from "./ids";

// One app page (Zimam: a page per platform) saves all of that platform's pixels at once. They arrive as the JSON
// field "accounts": one entry per ad account (Google Analytics / Tag Manager: one). A saved row keeps its id; an
// entry with an empty secret keeps the saved one.
const account = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().max(80),
  tagId: z.string().max(80),
  secret: z.string().trim().max(500),
  clearSecret: z.boolean(),
  testCode: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/),
  purchaseOn: z.enum(purchaseTriggers),
  productIds: z.array(z.string().uuid()).max(100).nullable(),
  active: z.boolean(),
});
export type PixelAccount = z.infer<typeof account>;

export const MAX_ACCOUNTS = 10;

// Returns the accounts to keep (blank single-ID entries are dropped = removed) or field errors keyed
// "<field>.<index>" (each card shows its own).
export function parseAccounts(platform: PixelPlatform, raw: unknown): { ok: true; accounts: PixelAccount[] } | { ok: false; fieldErrors: Record<string, string> } {
  let json: unknown;
  try {
    json = JSON.parse(String(raw ?? "[]"));
  } catch {
    return { ok: false, fieldErrors: { form: "invalid" } };
  }
  const parsed = z.array(account).max(multiAccount(platform) ? MAX_ACCOUNTS : 1).safeParse(json);
  if (!parsed.success) return { ok: false, fieldErrors: { form: "invalid" } };
  const fieldErrors: Record<string, string> = {};
  const seen = new Set<string>();
  const accounts: PixelAccount[] = [];
  parsed.data.forEach((a, i) => {
    const tagId = normalizeTag(platform, a.tagId);
    // Google's single ID left empty: nothing to keep
    if (!tagId && !multiAccount(platform)) return;
    if (!isValidTag(platform, tagId)) fieldErrors[`tagId.${i}`] = tagId ? "tagId" : "required";
    else if (seen.has(tagId)) fieldErrors[`tagId.${i}`] = "pixelDuplicate";
    seen.add(tagId);
    if (a.productIds && !a.productIds.length) fieldErrors[`productIds.${i}`] = "pixelProducts";
    accounts.push({ ...a, tagId, name: a.name || tagId });
  });
  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, accounts };
}
