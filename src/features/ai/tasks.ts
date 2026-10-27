import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { logError } from "@/server/errors";
import { canAdd } from "@/server/limits";
import { AiRequestError, aiConfigured, pollBackgroundJson, startBackgroundJson, type BackgroundRequest } from "@/server/ai/openai";
import type { PageLanguage } from "@/features/landing/types";
import { cleanCallGuide, cleanDescription, cleanMessages } from "./prompts";

// Small AI tasks share one path: start a background request (a row in ai_generations, counted in the
// plan's monthly AI quota), then the browser checks every few seconds; when the text is ready it is
// cleaned, saved where it belongs (e.g. the product's call guide) and returned.
export type TaskKind = "call_guide" | "messages" | "description";
export type TaskBrief = { language: PageLanguage; productId?: string };
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

// What a finished task produces (and saves): null when the model's answer is unusable
async function finish(shopId: string, kind: TaskKind, brief: TaskBrief, data: unknown) {
  if (kind === "call_guide") {
    const guide = cleanCallGuide(data, brief.language);
    if (guide && brief.productId) await db.update(schema.products).set({ callGuide: guide }).where(and(eq(schema.products.shopId, shopId), eq(schema.products.id, brief.productId)));
    return guide;
  }
  if (kind === "messages") return cleanMessages(data);
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
    const result = await pollBackgroundJson<unknown>(task.responseId ?? "");
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
