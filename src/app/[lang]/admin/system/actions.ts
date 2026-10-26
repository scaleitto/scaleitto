"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { asLocale } from "@/i18n";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { listModels, pollBackgroundJson, startBackgroundJson } from "@/lib/ai/openai";
import { uploadsDir } from "@/lib/storage";

export type AiCheckResult = { models?: string[]; error?: string };

export async function checkAi(lang: string): Promise<AiCheckResult> {
  await requireAdmin(asLocale(lang));
  try {
    return { models: await listModels() };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearErrors(lang: string) {
  await requireAdmin(asLocale(lang));
  await db.delete(schema.errorLogs);
  revalidatePath(`/${lang}/admin/system`);
}

export type CheckResult = { ok: boolean; detail: string };

// Writes, reads back and deletes a small file in the uploads folder.
export async function checkUploads(lang: string): Promise<CheckResult> {
  await requireAdmin(asLocale(lang));
  const dir = path.join(uploadsDir(), "_selftest");
  const file = path.join(dir, `${Date.now()}.txt`);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(file, "ok");
    const back = await readFile(file, "utf8");
    await unlink(file);
    return { ok: back === "ok", detail: uploadsDir() };
  } catch (err) {
    return { ok: false, detail: `${uploadsDir()}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Starts a tiny real background request (same path as landing generation).
export async function startBackgroundCheck(lang: string): Promise<CheckResult & { responseId?: string }> {
  await requireAdmin(asLocale(lang));
  try {
    const { responseId, model } = await startBackgroundJson({
      instructions: "You are a health check. Reply with JSON only.",
      user: 'Return {"ok": true}.',
      schemaName: "health_check",
      schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } },
      maxOutputTokens: 2000,
    });
    return { ok: true, detail: model, responseId };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function pollBackgroundCheck(lang: string, responseId: string): Promise<CheckResult & { pending?: boolean }> {
  await requireAdmin(asLocale(lang));
  try {
    const r = await pollBackgroundJson<{ ok?: boolean }>(responseId);
    if (r.state === "pending") return { ok: false, pending: true, detail: "" };
    if (r.state === "failed") return { ok: false, detail: r.error };
    return { ok: r.data.ok === true, detail: `${r.model} · ${r.inputTokens + r.outputTokens} tokens` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
