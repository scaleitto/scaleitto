"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { AiLanguage as PageLanguage } from "./languages";
import { startDescriptionAi } from "./actions";
import { useAiTask } from "./useAiTask";

// Fills the product form's description (fields #name, #description, #price) with an AI-written text
export function DescriptionButton({ lang, language, images, t }: { lang: string; language: PageLanguage; images: string[]; t: Pick<Dictionary, "assistant" | "errors"> }) {
  const d = t.assistant.description;
  const task = useAiTask<{ description: string }>(lang, t.errors as Record<string, string>);
  const [hint, setHint] = useState<string | null>(null);
  const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  const write = async () => {
    const name = field("name")?.value.trim() ?? "";
    if (!name) return setHint(d.needName);
    setHint(null);
    const price = Number((field("price")?.value ?? "").replace(/\s/g, "")) || null;
    const result = await task.run(() => startDescriptionAi(lang, { name, price, notes: field("description")?.value ?? "", images, language }));
    const box = field("description");
    if (result && box) {
      // Set like a user typing, so the form keeps the text
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, result.description);
      box.dispatchEvent(new Event("input", { bubbles: true }));
      setHint(d.hint);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={write} disabled={task.working} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline disabled:opacity-60" data-testid="ai-description">
        {task.working ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} {task.working ? t.assistant.working : d.write}
      </button>
      {(task.error || hint) && <span className={`text-xs ${task.error ? "text-danger" : "text-muted"}`}>{task.error ?? hint}</span>}
    </div>
  );
}
