import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AiJobPrepared } from "@/db/schema";
import { newId } from "@/lib/auth";
import { canAdd } from "@/lib/limits";
import { slugify } from "@/lib/format";
import { readOwnUpload } from "@/lib/storage";
import { downloadImages, importProductFromUrl } from "@/lib/product-import";
import { safeFetch } from "@/lib/safe-fetch";
import { pollBackgroundJson, startBackgroundJson } from "./openai";
import { buildLandingRequest, finishLandingPage, type LandingAiOutput } from "./landing-generator";

// A landing-page generation is a small state machine driven by the browser:
//   prepare → submit → writing → done
// Each call of advanceLandingJob() runs ONE short step (a few seconds at most), so
// shared hosting never sees a long request and nothing has to run after a response.

const MAX_VISION_IMAGES = 4;
const CLAIM_SECONDS = 90;
// OpenAI keeps background results for a limited time; give up after this.
export const JOB_EXPIRY_MS = 15 * 60_000;

type Job = typeof schema.aiJobs.$inferSelect;
export type JobView = { status: Job["status"]; stage: string | null; landingPageId: string | null; error: string | null };

const view = (j: Job): JobView => ({ status: j.status, stage: j.stage, landingPageId: j.landingPageId, error: j.error });

async function patch(id: string, values: Partial<typeof schema.aiJobs.$inferInsert>) {
  await db.update(schema.aiJobs).set(values).where(eq(schema.aiJobs.id, id));
}

// Images as data: URLs so the model sees them even if our site is not reachable from OpenAI.
async function toDataUrls(urls: string[]): Promise<string[]> {
  const results = await Promise.all(
    urls.slice(0, MAX_VISION_IMAGES).map(async (url) => {
      try {
        const own = await readOwnUpload(url);
        if (own) return `data:${own.mime};base64,${own.buf.toString("base64")}`;
        const res = await safeFetch(url, { maxBytes: 4 * 1024 * 1024, timeoutMs: 8_000, accept: "image/*" });
        const mime = res.contentType.split(";")[0].trim();
        return res.status === 200 && mime.startsWith("image/") ? `data:${mime};base64,${res.body.toString("base64")}` : null;
      } catch {
        return null; // an unreadable image is simply not shown to the model
      }
    }),
  );
  return results.filter((x): x is string => !!x);
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

async function loadProduct(job: Job) {
  if (!job.input.productId) return null;
  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.id, job.input.productId), eq(schema.products.shopId, job.shopId)));
  return product ?? null;
}

// Step 1: gather facts and images (link import, image downloads, existing product).
async function prepare(job: Job): Promise<AiJobPrepared> {
  const input = job.input;
  if (input.source === "product") {
    const product = await loadProduct(job);
    if (!product) throw new Error("Product not found");
    return { images: product.images.slice(0, 10), sourceText: "", productName: product.name };
  }
  if (input.source === "images") {
    return { images: (input.images ?? []).slice(0, 10), sourceText: "", productName: "" };
  }
  const imported = await importProductFromUrl(input.link ?? "");
  const downloaded = await downloadImages(job.shopId, imported.images);
  return {
    images: [...(input.images ?? []), ...downloaded].slice(0, 10),
    sourceText: [imported.title, imported.description].filter(Boolean).join("\n\n"),
    productName: imported.title,
  };
}

// Step 2: send the request to OpenAI in background mode.
async function submit(job: Job, prepared: AiJobPrepared) {
  const product = job.input.source === "product" ? await loadProduct(job) : null;
  const request = buildLandingRequest({
    product: {
      name: product?.name ?? (prepared.productName || "Product"),
      description: product?.description ?? null,
      price: product?.price ?? job.input.price ?? 0,
      compareAtPrice: product ? product.compareAtPrice : (job.input.compareAtPrice ?? null),
      images: prepared.images,
      options: product?.options ?? [],
      offers: product?.offers ?? [],
    },
    language: job.input.language,
    tone: job.input.tone,
    audience: job.input.audience,
    notes: job.input.notes,
    visionImages: await toDataUrls(prepared.images),
    sourceText: prepared.sourceText,
    writeProduct: !product,
  });
  return startBackgroundJson(request);
}

// Step 4: create the product (when new) and the draft landing page.
async function save(job: Job, prepared: AiJobPrepared, data: LandingAiOutput, usage: { model: string; inputTokens: number; outputTokens: number }) {
  let product = job.input.source === "product" ? await loadProduct(job) : null;
  const page = finishLandingPage(data, product?.name ?? (prepared.productName || "Product"), prepared.images);

  if (!product) {
    if (!(await canAdd(job.shopId, "maxProducts"))) throw new Error("PRODUCT_LIMIT");
    const name = page.productName || prepared.productName || page.title;
    const id = newId();
    await db.insert(schema.products).values({
      id,
      shopId: job.shopId,
      name,
      slug: await uniqueSlug(schema.products, job.shopId, name),
      description: page.productDescription ?? "",
      price: job.input.price ?? 0,
      compareAtPrice: job.input.compareAtPrice ?? null,
      stock: 0,
      trackStock: false,
      images: prepared.images,
      options: [],
      status: "active",
    });
    [product] = await db.select().from(schema.products).where(eq(schema.products.id, id));
  }

  const landingPageId = newId();
  await db.insert(schema.landingPages).values({
    id: landingPageId,
    shopId: job.shopId,
    productId: product!.id,
    slug: await uniqueSlug(schema.landingPages, job.shopId, page.title),
    title: page.title,
    sections: page.sections,
    status: "draft",
    locale: job.input.language === "dz" ? "ar" : job.input.language,
  });
  await db.insert(schema.aiGenerations).values({
    id: newId(),
    shopId: job.shopId,
    userId: job.userId,
    kind: "landing_page",
    model: usage.model || job.model || "",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return landingPageId;
}

// Runs at most one step of the job and returns its state. Safe to call repeatedly and concurrently.
export async function advanceLandingJob(jobId: string, shopId: string): Promise<JobView> {
  const [job] = await db.select().from(schema.aiJobs).where(and(eq(schema.aiJobs.id, jobId), eq(schema.aiJobs.shopId, shopId)));
  if (!job) return { status: "failed", stage: null, landingPageId: null, error: "Job not found" };
  if (job.status === "done" || job.status === "failed") return view(job);
  if (Date.now() - job.createdAt.getTime() > JOB_EXPIRY_MS) {
    await patch(job.id, { status: "failed", error: "Took too long. Please try again." });
    return { ...view(job), status: "failed", error: "Took too long. Please try again." };
  }

  // Claim the job so two requests never run the same step at once.
  const [claim] = await db
    .update(schema.aiJobs)
    .set({ claimedUntil: sql`DATE_ADD(NOW(), INTERVAL ${CLAIM_SECONDS} SECOND)` })
    .where(and(eq(schema.aiJobs.id, job.id), or(isNull(schema.aiJobs.claimedUntil), lt(schema.aiJobs.claimedUntil, sql`NOW()`))));
  if (claim.affectedRows === 0) return view(job);

  try {
    const stage = job.stage ?? "prepare";
    if (stage === "prepare") {
      const prepared = await prepare(job);
      await patch(job.id, { status: "running", stage: "submit", prepared });
    } else if (stage === "submit") {
      const { responseId, model } = await submit(job, job.prepared!);
      await patch(job.id, { stage: "writing", responseId, model });
    } else if (stage === "writing") {
      const result = await pollBackgroundJson<LandingAiOutput>(job.responseId!);
      if (result.state === "failed") {
        await patch(job.id, { status: "failed", error: result.error.slice(0, 2000) });
      } else if (result.state === "done") {
        await patch(job.id, { stage: "saving" });
        const landingPageId = await save(job, job.prepared!, result.data, result);
        await patch(job.id, { status: "done", stage: null, landingPageId });
      }
    } else if (stage === "saving") {
      // A previous save was interrupted: the response is still available, save again.
      const result = await pollBackgroundJson<LandingAiOutput>(job.responseId!);
      if (result.state === "done") {
        const landingPageId = await save(job, job.prepared!, result.data, result);
        await patch(job.id, { status: "done", stage: null, landingPageId });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-job ${job.id}] step failed:`, err);
    await patch(job.id, { status: "failed", error: message.slice(0, 2000) }).catch(() => {});
  } finally {
    await patch(job.id, { claimedUntil: null }).catch(() => {});
  }
  const [after] = await db.select().from(schema.aiJobs).where(eq(schema.aiJobs.id, job.id));
  return view(after ?? job);
}
