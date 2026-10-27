"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle, PhoneCall, Sparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Alert, Button, Card, Select } from "@/ui";
import { pageLanguages, type PageLanguage } from "@/features/landing/types";
import type { CallGuide } from "./prompts";
import { startCallGuide } from "./actions";
import { useAiTask } from "./useAiTask";

type Text = Pick<Dictionary, "assistant" | "errors" | "landingPages">;

// The product's call guide on the order page: created once by the AI, read by every agent
export function CallGuideCard({ lang, product, guide: saved, t }: { lang: string; product: { id: string; name: string }; guide: CallGuide | null; t: Text }) {
  const c = t.assistant.callGuide;
  const router = useRouter();
  const [guide, setGuide] = useState(saved);
  const [language, setLanguage] = useState<PageLanguage>(saved?.language ?? "dz");
  const task = useAiTask<CallGuide>(lang, t.errors as Record<string, string>);
  const generate = async () => {
    const result = await task.run(() => startCallGuide(lang, product.id, language));
    if (result) {
      setGuide(result);
      router.refresh();
    }
  };
  const block = (title: string, children: React.ReactNode) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-accent">{title}</p>
      {children}
    </div>
  );
  return (
    <Card className="space-y-4" data-testid="call-guide" data-product={product.id}>
      <div className="flex items-start gap-3">
        <PhoneCall size={18} className="mt-0.5 shrink-0 text-accent" />
        <div className="me-auto">
          <h2 className="font-semibold">
            {c.title} · <span className="text-muted">{product.name}</span>
          </h2>
          {!guide && <p className="mt-0.5 text-xs text-muted">{c.hint}</p>}
        </div>
      </div>
      {guide && (
        <div className="space-y-4 text-sm" dir="auto">
          {block(c.pitch, <p className="leading-relaxed whitespace-pre-line">{guide.pitch}</p>)}
          {block(
            c.keyPoints,
            <ul className="list-disc space-y-1 ps-5">
              {guide.keyPoints.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>,
          )}
          {block(
            c.objections,
            <div className="space-y-1.5">
              {guide.objections.map((o) => (
                <details key={o.q} className="group rounded-lg border border-line px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
                    «{o.q}»
                    <ChevronDown size={15} className="shrink-0 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 leading-relaxed whitespace-pre-line text-muted">{o.a}</p>
                </details>
              ))}
            </div>,
          )}
          {block(
            c.questions,
            <ul className="list-disc space-y-1 ps-5">
              {guide.questions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>,
          )}
          {block(c.closing, <p className="leading-relaxed whitespace-pre-line">{guide.closing}</p>)}
          <p className="text-xs text-muted">{c.honesty}</p>
        </div>
      )}
      {task.error && <Alert>{task.error}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-48">
          <Select aria-label={t.assistant.language} value={language} onChange={(e) => setLanguage(e.target.value as PageLanguage)} className="py-1.5 text-sm">
            {pageLanguages.map((l) => (
              <option key={l} value={l}>
                {t.landingPages.languages[l]}
              </option>
            ))}
          </Select>
        </div>
        <Button variant={guide ? "secondary" : "primary"} disabled={task.working} onClick={generate}>
          {task.working ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} {task.working ? t.assistant.working : guide ? c.regenerate : c.generate}
        </Button>
      </div>
    </Card>
  );
}
