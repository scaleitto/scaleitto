import { z } from "zod";
import { pixelPlatforms, purchaseTriggers } from "@/server/db/schema";
import { isValidTag, normalizeTag } from "./ids";

// A pixel from the dashboard form. Products arrive as checkboxes named "productIds".
export function parsePixel(formData: FormData) {
  return z
    .object({
      platform: z.enum(pixelPlatforms, { error: "e:invalid" }),
      name: z.string().trim().min(1, "e:required").max(80, "e:invalid"),
      tagId: z.string(),
      secret: z.string().trim().max(500, "e:invalid"),
      clearSecret: z.preprocess((v) => v === "on", z.boolean()),
      testCode: z.string().trim().max(40, "e:invalid").regex(/^[A-Za-z0-9_-]*$/, "e:invalid"),
      purchaseOn: z.enum(purchaseTriggers, { error: "e:invalid" }),
      scope: z.enum(["all", "products"], { error: "e:invalid" }),
      productIds: z.array(z.string().uuid()).max(100),
    })
    .transform((d) => ({ ...d, tagId: normalizeTag(d.platform, d.tagId) }))
    .superRefine((d, ctx) => {
      if (!isValidTag(d.platform, d.tagId)) ctx.addIssue({ code: "custom", path: ["tagId"], message: "e:tagId" });
      if (d.scope === "products" && !d.productIds.length) ctx.addIssue({ code: "custom", path: ["productIds"], message: "e:pixelProducts" });
    })
    .safeParse({
      platform: formData.get("platform"),
      name: formData.get("name") ?? "",
      tagId: formData.get("tagId") ?? "",
      secret: formData.get("secret") ?? "",
      clearSecret: formData.get("clearSecret"),
      testCode: formData.get("testCode") ?? "",
      purchaseOn: formData.get("purchaseOn") ?? "placed",
      scope: formData.get("scope") ?? "all",
      productIds: formData.getAll("productIds"),
    });
}
