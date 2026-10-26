import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AiJobInput } from "@/db/schema";
import { newId } from "@/lib/auth";
import { canAdd } from "@/lib/limits";
import { slugify } from "@/lib/format";
import { readOwnUpload } from "@/lib/storage";
import { downloadImages, importProductFromUrl } from "@/lib/product-import";
import { safeFetch } from "@/lib/safe-fetch";
import { AiRequestError } from "./openai";
import { generateLandingPage } from "./landing-generator";

export type JobStage = "starting" | "importing" | "images" | "writing" | "saving";

const MAX_VISION_IMAGES = 4;

async function setJob(id: string, patch: Partial<typeof schema.aiJobs.$inferInsert>) {
  await db.update(schema.aiJobs).set(patch).where(eq(schema.aiJobs.id, id));
}

// Images as data: URLs so the model sees them even when our site is not reachable from OpenAI.
async function toDataUrls(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls.slice(0, MAX_VISION_IMAGES)) {
    try {
      const own = await readOwnUpload(url);
      if (own) {
        out.push(`data:${own.mime};base64,${own.buf.toString("base64")}`);
        continue;
      }
      const res = await safeFetch(url, { maxBytes: 4 * 1024 * 1024, accept: "image/*" });
      const mime = res.contentType.split(";")[0].trim();
      if (res.status === 200 && mime.startsWith("image/")) out.push(`data:${mime};base64,${res.body.toString("base64")}`);
    } catch {
      // an unreadable image is simply not shown to the model
    }
  }
  return out;
}

async function uniqueSlug(table: typeof schema.landingPages | typeof schema.products, shopId: string, text: string) {
  const base = slugify(text);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [taken] = await db.select({ id: table.id }).from(table).where(and(eq(table.shopId, shopId), eq(table.slug, slug)));
    if (!taken) return slug;
  }
  return `${base}-${Date.now()}`;
}

// Runs one landing-page generation job end to end. Never throws: failures are stored on the job.
export async function runLandingJob(jobId: string) {
  const [job] = await db.select().from(schema.aiJobs).where(eq(schema.aiJobs.id, jobId));
  if (!job || job.status !== "queued") return;
  const input: AiJobInput = job.input;
  const shopId = job.shopId;

  try {
    await setJob(jobId, { status: "running", stage: "starting" });

    let product: typeof schema.products.$inferSelect | null = null;
    let images: string[] = [];
    let sourceText = "";
    let importedTitle = "";

    if (input.source === "product") {
      [product] = await db
        .select()
        .from(schema.products)
        .where(and(eq(schema.products.id, input.productId ?? ""), eq(schema.products.shopId, shopId)));
      if (!product) throw new Error("Product not found");
      images = product.images;
    } else if (input.source === "images") {
      images = (input.images ?? []).slice(0, 10);
    } else {
      await setJob(jobId, { stage: "importing" });
      const imported = await importProductFromUrl(input.link ?? "");
      importedTitle = imported.title;
      sourceText = [imported.title, imported.description].filter(Boolean).join("\n\n");
      await setJob(jobId, { stage: "images" });
      images = [...(input.images ?? []), ...(await downloadImages(shopId, imported.images))].slice(0, 10);
    }

    await setJob(jobId, { stage: "writing" });
    const page = await generateLandingPage({
      product: {
        name: product?.name ?? (importedTitle || "Product"),
        description: product?.description ?? null,
        price: product?.price ?? input.price ?? 0,
        compareAtPrice: product ? product.compareAtPrice : (input.compareAtPrice ?? null),
        images,
        options: product?.options ?? [],
        offers: product?.offers ?? [],
      },
      language: input.language,
      tone: input.tone,
      audience: input.audience,
      notes: input.notes,
      visionImages: await toDataUrls(images),
      sourceText,
      writeProduct: !product,
    });

    await setJob(jobId, { stage: "saving" });
    if (!product) {
      if (!(await canAdd(shopId, "maxProducts"))) throw new Error("PRODUCT_LIMIT");
      const name = page.productName || importedTitle || page.title;
      const id = newId();
      await db.insert(schema.products).values({
        id,
        shopId,
        name,
        slug: await uniqueSlug(schema.products, shopId, name),
        description: page.productDescription ?? "",
        price: input.price ?? 0,
        compareAtPrice: input.compareAtPrice ?? null,
        stock: 0,
        trackStock: false,
        images,
        options: [],
        status: "active",
      });
      [product] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    }

    const landingPageId = newId();
    await db.insert(schema.landingPages).values({
      id: landingPageId,
      shopId,
      productId: product!.id,
      slug: await uniqueSlug(schema.landingPages, shopId, page.title),
      title: page.title,
      sections: page.sections,
      status: "draft",
      locale: input.language === "dz" ? "ar" : input.language,
    });
    await db.insert(schema.aiGenerations).values({
      id: newId(),
      shopId,
      userId: job.userId,
      kind: "landing_page",
      model: page.model,
      inputTokens: page.inputTokens,
      outputTokens: page.outputTokens,
    });
    await setJob(jobId, { status: "done", stage: null, landingPageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-job ${jobId}] failed:`, err);
    await setJob(jobId, { status: "failed", error: message.slice(0, 2000) }).catch(() => {});
    if (!(err instanceof AiRequestError) && message !== "PRODUCT_LIMIT") {
      await db
        .insert(schema.errorLogs)
        .values({ id: newId(), message: `AI job failed: ${message}`.slice(0, 2000), stack: err instanceof Error ? err.stack?.slice(0, 6000) : null, path: `ai-job/${jobId}`, routeType: "job" })
        .catch(() => {});
    }
  }
}

// A job whose process died (server restart, crash) stays "running" forever; treat it as failed.
export const STALE_JOB_MS = 6 * 60_000;
