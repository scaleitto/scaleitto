"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleX, LoaderCircle, Stethoscope } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { AiCheckStep } from "@/server/ai/openai";
import { Button, Card } from "@/ui";
import { testAi } from "./ai-actions";

// Shows every step of the AI path with OpenAI's exact answer, so a problem on the live server is visible.
export function AiTestCard({ lang, t }: { lang: string; t: Dictionary["landingPages"]["ai"] }) {
  const [steps, setSteps] = useState<AiCheckStep[] | null>(null);
  const [pending, startTransition] = useTransition();
  const allOk = steps?.length && steps.every((s) => s.ok);
  return (
    <Card className="space-y-3" data-testid="ai-test">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t.test}</h2>
          <p className="mt-0.5 text-xs text-muted">{t.testHint}</p>
        </div>
        <Button variant="secondary" disabled={pending} onClick={() => startTransition(async () => setSteps(await testAi(lang)))}>
          {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Stethoscope size={15} />} {pending ? t.testing : t.test}
        </Button>
      </div>
      {steps && (
        <>
          <p className={`text-sm font-semibold ${allOk ? "text-accent" : "text-danger"}`}>{allOk ? t.testOk : t.testFailed}</p>
          <ul className="space-y-1.5 text-sm">
            {steps.map((s) => (
              <li key={s.step} className="flex items-start gap-2">
                {s.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-accent" /> : <CircleX size={16} className="mt-0.5 shrink-0 text-danger" />}
                <span>
                  <span className="font-medium">{t.testSteps[s.step]}</span>
                  <span className="block text-xs break-all text-muted" dir="ltr">
                    {s.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
