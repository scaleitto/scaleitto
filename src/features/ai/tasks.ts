import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { logError } from "@/server/errors";
import { canAdd } from "@/server/limits";
import { AiRequestError, aiConfigured, pollBackgroundImage, pollBackgroundJson, startBackgroundImage, startBackgroundJson, type BackgroundRequest } from "@/server/ai/openai";
import { visionImages } from "@/server/ai/vision";
import { saveImage } from "@/server/storage";
import type { AiLanguage as PageLanguage } from "./languages";
import { cleanDescription } from "./prompts";

// Small AI tasks share one path: start a background request (a row in ai_generations, counted in the
// plan's monthly AI quota), then the browser checks every few seconds; when the text is ready it is
// cleaned, saved where it belongs (e.g. the product's call guide) and returned.
export type TaskKind = "description" | "image";
export type TaskBrief = { language: PageLanguage; productId?: string } | { poster: true; references: string[] };
export type TaskStart = { ok: true; taskId: string } | { ok: false; error: string; message?: string };
export type TaskState = { state: "pending" } | { state: "done"; result: unknown } | { state: "failed"; error: string; message?: string };

export async function startTask(shopId: string, userId: string, kind: TaskKind, request: BackgroundRequest, brief: TaskBrief): Promise<TaskStart> {
  try {
    if (!aiConfigured()) return { ok: false, error: "aiNotConfigured" };
    if (!(await canAdd(shopId, "maxAiPerMonth"))) return { ok: false, error: "limitAi" };
    const started = await startBackgroundJson(request);
    const taskId = newId();
    await db.insert(schema.aiGenerations).values({ id: taskId, shopId, userId, kind, responseId: started.responseId, model: started.model, brief });
    return { ok: true, taskId };
  } catch (err) {
    if (err instanceof AiRequestError) return { ok: false, error: "aiFailed", message: err.message };
    await logError(`ai/start-${kind}`, err);
    return { ok: false, error: "unexpected" };
  }
}

// Designs one image of an image landing page (text inside), from the shop's own photos as references.
// `references`: our uploads only (the product photos, and possibly the section's current image).
export async function startPosterTask(shopId: string, userId: string, prompt: string, references: string[], size: "1024x1536" | "1024x1024" = "1024x1536"): Promise<TaskStart> {
  try {
    if (!aiConfigured()) return { ok: false, error: "aiNotConfigured" };
    const own = references.filter((r) => r.startsWith(`/uploads/${shopId}/`)).slice(0, 4);
    if (!(await canAdd(shopId, "maxAiPerMonth"))) return { ok: false, error: "limitAi" };
    const images = await visionImages(own, 4);
    const started = await startBackgroundImage({ prompt, images, size });
    const taskId = newId();
    await db.insert(schema.aiGenerations).values({ id: taskId, shopId, userId, kind: "image", responseId: started.responseId, model: started.model, brief: { poster: true, references: own } });
    return { ok: true, taskId };
  } catch (err) {
    if (err instanceof AiRequestError) return { ok: false, error: "aiFailed", message: err.message };
    await logError("ai/start-poster", err);
    return { ok: false, error: "unexpected" };
  }
}

// What a finished task produces (and saves): null when the model's answer is unusable
async function finish(shopId: string, kind: TaskKind, brief: TaskBrief, data: unknown) {
  if (kind === "image") {
    // An answer that is not a real image counts as unusable
    const url = await saveImage(shopId, Buffer.from(String(data), "base64")).catch(() => null);
    return url ? { url } : null;
  }
  if (!("language" in brief)) return null;
  const description = cleanDescription(data);
  return description ? { description } : null;
}

export async function pollTask(shopId: string, taskId: string): Promise<TaskState> {
  try {
    const g = schema.aiGenerations;
    const [task] = await db.select().from(g).where(and(eq(g.shopId, shopId), eq(g.id, taskId)));
    if (!task || task.kind === "landing") return { state: "failed", error: "notFound" };
    if (task.status === "done") return { state: "done", result: task.result };
    if (task.status === "failed") return { state: "failed", error: "aiFailed", message: task.error ?? undefined };
    if (task.status === "saving") return { state: "pending" };
    const result = task.kind === "image" ? await imageAsResult(task.responseId ?? "") : await pollBackgroundJson<unknown>(task.responseId ?? "");
    if (result.state === "pending") return { state: "pending" };
    if (result.state === "failed") {
      await db.update(g).set({ status: "failed", error: result.error.slice(0, 2000) }).where(eq(g.id, task.id));
      return { state: "failed", error: "aiFailed", message: result.error };
    }
    // Only one check saves the result (the browser can send two at once)
    const [claim] = await db.update(g).set({ status: "saving" }).where(and(eq(g.id, task.id), eq(g.status, "pending")));
    if (!claim.affectedRows) return { state: "pending" };
    const output = await finish(shopId, task.kind as TaskKind, task.brief as TaskBrief, result.data);
    if (!output) {
      await db.update(g).set({ status: "failed", error: "Unusable answer" }).where(eq(g.id, task.id));
      return { state: "failed", error: "aiFailed", message: "Unusable answer" };
    }
    await db.update(g).set({ status: "done", result: output, inputTokens: result.inputTokens, outputTokens: result.outputTokens, model: result.model || task.model }).where(eq(g.id, task.id));
    return { state: "done", result: output };
  } catch (err) {
    await logError("ai/poll-task", err);
    return { state: "failed", error: "unexpected" };
  }
}

// An image answer in the same shape as a text one (data = the image as base64)
async function imageAsResult(responseId: string) {
  const r = await pollBackgroundImage(responseId);
  return r.state === "done" ? { state: "done" as const, data: r.base64 as unknown, model: r.model, inputTokens: 0, outputTokens: 0 } : r;
}
