"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleX, LoaderCircle, Stethoscope } from "lucide-react";
import { Button, Card } from "@/ui";

export type CheckStep = { step: string; ok: boolean; detail: string };

// A "run the check" card: each step with ✓ / ✗ and the exact reason, so a problem on the live server is visible.
export function CheckCard({
  run,
  labels,
  t,
  testId,
}: {
  run: () => Promise<CheckStep[]>;
  labels: Record<string, string>;
  t: { title: string; hint: string; button: string; running: string; ok: string; failed: string };
  testId: string;
}) {
  const [steps, setSteps] = useState<CheckStep[] | null>(null);
  const [pending, startTransition] = useTransition();
  const allOk = steps?.length && steps.every((s) => s.ok);
  return (
    <Card className="space-y-3" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t.title}</h2>
          <p className="mt-0.5 text-xs text-muted">{t.hint}</p>
        </div>
        <Button variant="secondary" disabled={pending} onClick={() => startTransition(async () => setSteps(await run()))}>
          {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Stethoscope size={15} />} {pending ? t.running : t.button}
        </Button>
      </div>
      {steps && (
        <>
          <p className={`text-sm font-semibold ${allOk ? "text-accent" : "text-danger"}`} data-result={allOk ? "ok" : "failed"}>
            {allOk ? t.ok : t.failed}
          </p>
          <ul className="space-y-1.5 text-sm">
            {steps.map((s) => (
              <li key={s.step} className="flex items-start gap-2" data-step={s.step} data-ok={s.ok ? "1" : "0"}>
                {s.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-accent" /> : <CircleX size={16} className="mt-0.5 shrink-0 text-danger" />}
                <span>
                  <span className="font-medium">{labels[s.step] ?? s.step}</span>
                  <span className="block text-xs break-all text-muted" dir="auto">
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
