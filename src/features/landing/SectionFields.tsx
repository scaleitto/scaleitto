"use client";

import { useState } from "react";
import { LoaderCircle, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Field, Input, Textarea } from "@/ui";
import { ImageManager } from "@/ui/ImageManager";
import type { LandingSection } from "./types";
import { startImageEnhance } from "@/features/ai/actions";
import { useAiTask } from "@/features/ai/useAiTask";
import { imageStyles as styleKeys } from "@/lib/enums";

export type EditorText = Pick<Dictionary, "landingPages" | "media" | "errors" | "common">;

const lines = (v: string) => v.split("\n").map((x) => x.trimStart());
const addButton = "inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline";

// Rework the chosen photo with the AI (same product, new background), then use the new one
function EnhanceImage({ lang, src, onDone, t }: { lang: string; src: string; onDone: (url: string) => void; t: EditorText }) {
  const f = t.landingPages.editor.fields;
  const [style, setStyle] = useState<(typeof styleKeys)[number]>("studio");
  const task = useAiTask<{ url: string }>(lang, t.errors as Record<string, string>);
  return (
    <div className="space-y-1.5 rounded-lg bg-panel-2 p-2" data-testid="enhance-image">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={f.enhance} value={style} onChange={(e) => setStyle(e.target.value as typeof style)} className="rounded-md border border-line bg-bg px-2 py-1 text-xs">
          {styleKeys.map((k) => (
            <option key={k} value={k}>
              {f.styles[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={task.working}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline disabled:opacity-60"
          onClick={async () => {
            const result = await task.run(() => startImageEnhance(lang, src, style));
            if (result) onDone(result.url);
          }}
        >
          {task.working ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />} {task.working ? f.enhancing : f.enhance}
        </button>
      </div>
      {task.error && <p className="text-xs text-danger">{task.error}</p>}
    </div>
  );
}

// One image: pick one of the product's photos or upload a new one.
function ImagePicker({ lang, value, onChange, productImages, t }: { lang: string; value?: string; onChange: (v: string | undefined) => void; productImages: string[]; t: EditorText }) {
  const f = t.landingPages.editor.fields;
  return (
    <div className="space-y-2">
      {productImages.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted">{f.productImages}</p>
          <div className="flex flex-wrap gap-2">
            {productImages.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => onChange(src)}
                className={`size-14 overflow-hidden rounded-lg border-2 ${value === src ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"}`}
                aria-label={src}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <ImageManager t={t.media} value={value ? [value] : []} onChange={(imgs) => onChange(imgs[0])} max={1} />
      {value?.startsWith("/uploads/") && <EnhanceImage key={value} lang={lang} src={value} onDone={onChange} t={t} />}
    </div>
  );
}

// The fields of one section. `set` merges changes into the section.
export function SectionFields({ lang, section, set, productImages, t }: { lang: string; section: LandingSection; set: (patch: Partial<LandingSection>) => void; productImages: string[]; t: EditorText }) {
  const ed = t.landingPages.editor;
  const f = ed.fields;
  const p = (patch: Record<string, unknown>) => set(patch as Partial<LandingSection>);
  const titleField = (value: string | undefined, label = f.title) => <Field label={label}><Input value={value ?? ""} maxLength={200} onChange={(e) => p({ title: e.target.value })} /></Field>;

  switch (section.type) {
    case "hero":
      return (
        <div className="space-y-3">
          {titleField(section.title)}
          <Field label={f.subtitle}>
            <Textarea rows={2} maxLength={400} value={section.subtitle ?? ""} onChange={(e) => p({ subtitle: e.target.value })} />
          </Field>
          <Field label={f.badge}>
            <Input value={section.badge ?? ""} maxLength={40} onChange={(e) => p({ badge: e.target.value })} />
          </Field>
          <Field label={f.image}>
            <ImagePicker lang={lang} value={section.image} onChange={(image) => p({ image })} productImages={productImages} t={t} />
          </Field>
        </div>
      );
    case "badges":
    case "features":
    case "steps":
      return (
        <div className="space-y-3">
          {section.type !== "badges" && titleField(section.title)}
          <Field label={f.items}>
            <Textarea rows={5} value={section.items.join("\n")} onChange={(e) => p({ items: lines(e.target.value) })} />
          </Field>
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          {titleField(section.title)}
          <Field label={f.body}>
            <Textarea rows={6} maxLength={3000} value={section.body} onChange={(e) => p({ body: e.target.value })} />
          </Field>
        </div>
      );
    case "imageText":
      return (
        <div className="space-y-3">
          {titleField(section.title)}
          <Field label={f.body}>
            <Textarea rows={4} maxLength={2000} value={section.body} onChange={(e) => p({ body: e.target.value })} />
          </Field>
          <Field label={f.image}>
            <ImagePicker lang={lang} value={section.image} onChange={(image) => p({ image })} productImages={productImages} t={t} />
          </Field>
        </div>
      );
    case "benefits":
      return (
        <div className="space-y-3">
          {titleField(section.title)}
          {section.items.map((item, i) => {
            const update = (patch: Partial<typeof item>) => p({ items: section.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="space-y-2 rounded-lg border border-line p-3">
                <div className="flex gap-2">
                  <Input aria-label={f.icon} placeholder="✨" className="w-16 text-center" value={item.icon} maxLength={8} onChange={(e) => update({ icon: e.target.value })} />
                  <Input aria-label={f.benefitTitle} placeholder={f.benefitTitle} value={item.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} />
                  <button type="button" aria-label={ed.remove} className="rounded-lg p-2 text-muted hover:text-danger" onClick={() => p({ items: section.items.filter((_, j) => j !== i) })}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <Textarea aria-label={f.benefitText} placeholder={f.benefitText} rows={2} maxLength={400} value={item.text} onChange={(e) => update({ text: e.target.value })} />
              </div>
            );
          })}
          {section.items.length < 9 && (
            <button type="button" className={addButton} onClick={() => p({ items: [...section.items, { icon: "✨", title: "", text: "" }] })}>
              <Plus size={15} /> {f.addBenefit}
            </button>
          )}
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <ImagePicker lang={lang} value={section.url || undefined} onChange={(url) => p({ url: url ?? "" })} productImages={productImages} t={t} />
          <Field label={f.caption}>
            <Input value={section.caption ?? ""} maxLength={200} onChange={(e) => p({ caption: e.target.value })} />
          </Field>
        </div>
      );
    case "gallery":
      return (
        <div className="space-y-3">
          {titleField(section.title)}
          {productImages.some((src) => !section.images.includes(src)) && (
            <div className="flex flex-wrap gap-2">
              {productImages
                .filter((src) => !section.images.includes(src))
                .map((src) => (
                  <button key={src} type="button" onClick={() => p({ images: [...section.images, src].slice(0, 12) })} className="size-12 overflow-hidden rounded-lg border border-line opacity-70 hover:opacity-100" aria-label={`+ ${src}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="size-full object-cover" />
                  </button>
                ))}
            </div>
          )}
          <ImageManager t={t.media} value={section.images} onChange={(images) => p({ images })} max={12} />
        </div>
      );
    case "faq":
      return (
        <div className="space-y-3">
          {titleField(section.title)}
          {section.items.map((item, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-line p-3">
              <div className="flex gap-2">
                <Input aria-label={f.question} placeholder={f.question} value={item.q} maxLength={300} onChange={(e) => p({ items: section.items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
                <button type="button" aria-label={ed.remove} className="rounded-lg p-2 text-muted hover:text-danger" onClick={() => p({ items: section.items.filter((_, j) => j !== i) })}>
                  <Trash2 size={15} />
                </button>
              </div>
              <Textarea aria-label={f.answer} placeholder={f.answer} rows={2} maxLength={1500} value={item.a} onChange={(e) => p({ items: section.items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
            </div>
          ))}
          <button type="button" className={addButton} onClick={() => p({ items: [...section.items, { q: "", a: "" }] })}>
            <Plus size={15} /> {f.addQuestion}
          </button>
        </div>
      );
    case "reviews":
      return (
        <div className="space-y-3">
          <p className="text-xs text-warning">{ed.reviewsHint}</p>
          {titleField(section.title)}
          {section.items.map((item, i) => {
            const update = (patch: Partial<typeof item>) => p({ items: section.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="space-y-2 rounded-lg border border-line p-3">
                <div className="flex items-center gap-2">
                  <Input aria-label={f.name} placeholder={f.name} value={item.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} />
                  <div className="flex shrink-0" aria-label={f.rating}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => update({ rating: n })} className="p-0.5 text-warning" aria-label={`${n}/5`}>
                        <Star size={16} fill={n <= item.rating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  <button type="button" aria-label={ed.remove} className="rounded-lg p-2 text-muted hover:text-danger" onClick={() => p({ items: section.items.filter((_, j) => j !== i) })}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <Textarea aria-label={f.review} placeholder={f.review} rows={2} maxLength={800} value={item.text} onChange={(e) => update({ text: e.target.value })} />
              </div>
            );
          })}
          <button type="button" className={addButton} onClick={() => p({ items: [...section.items, { name: "", text: "", rating: 5 }] })}>
            <Plus size={15} /> {f.addReview}
          </button>
        </div>
      );
    case "video":
      return (
        <Field label={f.videoUrl}>
          <Input dir="ltr" placeholder="https://www.youtube.com/watch?v=…" value={section.url} onChange={(e) => p({ url: e.target.value })} />
        </Field>
      );
    case "countdown": {
      // datetime-local works in the browser's time: convert to/from an ISO date
      const local = new Date(section.endsAt);
      const value = Number.isNaN(local.getTime()) ? "" : new Date(local.getTime() - local.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted">{ed.countdownHint}</p>
          {titleField(section.title)}
          <Field label={f.endsAt}>
            <Input type="datetime-local" dir="ltr" value={value} onChange={(e) => e.target.value && p({ endsAt: new Date(e.target.value).toISOString() })} />
          </Field>
        </div>
      );
    }
    case "cta":
      return (
        <div className="space-y-3">
          {titleField(section.title)}
          <Field label={f.subtitle}>
            <Input value={section.subtitle ?? ""} maxLength={400} onChange={(e) => p({ subtitle: e.target.value })} />
          </Field>
        </div>
      );
    case "form":
      return <p className="text-sm text-muted">{ed.formHint}</p>;
  }
}
