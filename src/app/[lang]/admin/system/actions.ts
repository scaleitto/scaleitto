"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { asLocale } from "@/i18n";
import { listModels } from "@/lib/ai/openai";

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
