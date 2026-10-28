"use client";

import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { AiCheckStep } from "@/server/ai/openai";
import { CheckCard } from "@/ui/CheckCard";

// Every step of the AI path with OpenAI's exact answer
export function AiTestCard({ test, t }: { test: () => Promise<AiCheckStep[]>; t: Dictionary["landingPages"]["ai"] }) {
  return <CheckCard run={test} labels={t.testSteps} t={{ title: t.test, hint: t.testHint, button: t.test, running: t.testing, ok: t.testOk, failed: t.testFailed }} testId="ai-test" />;
}
