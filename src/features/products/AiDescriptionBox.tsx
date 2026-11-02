"use client";

import { useState } from "react";
import { Coins, Info, LoaderCircle, Sparkles, Wand2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { richTextFromPlain } from "@/lib/rich-text";
import { Button, Textarea } from "@/ui";
import { startDescriptionAi } from "@/features/ai/actions";
import { useAiTask } from "@/features/ai/useAiTask";
import type { AiLanguage } from "@/features/ai/languages";

// Zimam's "AI description writer": the merchant's key selling points (one per line) + the name, price and photos →
// a store-ready description, written into the editor as rich text (it replaces what is there; review before saving)
export function AiDescriptionBox({ lang, language, name, price, images, onResult, t }: { lang: string; language: AiLanguage; name: string; price: number | null; images: string[]; onResult: (html: string) => void; t: Pick<Dictionary, "products" | "assistant" | "errors"> }) {
  const p = t.products;
  const d = t.assistant.description;
  const task = useAiTask<{ description: string }>(lang, t.errors as Record<string, string>);
  const [points, setPoints] = useState("");
  const [done, setDone] = useState(false);
  const ready = name.trim().length > 0;
  const generate = async () => {
    if (!ready) return;
    setDone(false);
    const result = await task.run(() => startDescriptionAi(lang, { name: name.trim(), price, notes: points, images, language }));
    if (result) {
      onResult(richTextFromPlain(result.description));
      setDone(true);
    }
  };
  return (
    <div className="space-y-4 rounded-2xl border border-info/25 bg-gradient-to-br from-info/5 via-panel to-accent/5 p-5" data-testid="ai-writer">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-info text-white shadow-sm">
          <Sparkles size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{p.aiWriter}</h3>
          <p className="mt-0.5 text-sm text-muted">{p.aiWriterHint}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
          <Coins size={13} /> {p.aiCost}
        </span>
      </div>
      {!ready && (
        <p className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-muted" data-testid="ai-need-name">
          <Info size={14} /> {d.needName}
        </p>
      )}
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <label className="space-y-1.5">
          <span className="text-sm font-semibold">{p.sellingPoints}</span>
          <Textarea rows={3} value={points} onChange={(e) => setPoints(e.target.value)} placeholder={p.sellingPointsPlaceholder} maxLength={2000} data-testid="selling-points" />
        </label>
        <Button type="button" onClick={generate} disabled={!ready || task.working} className="h-12" data-testid="ai-description">
          {task.working ? <LoaderCircle size={16} className="animate-spin" /> : <Wand2 size={16} />} {task.working ? t.assistant.working : p.generateDescription}
        </Button>
      </div>
      {task.error && <p className="text-xs text-danger">{task.error}</p>}
      {done && !task.error && <p className="text-xs text-muted">{d.hint}</p>}
    </div>
  );
}
