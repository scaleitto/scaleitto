"use client";

import { useState } from "react";
import { LoaderCircle, Plus, RotateCcw, Sparkles, Star, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Button, Field, Input, Select, Textarea } from "@/ui";
import { ImageManager } from "@/ui/ImageManager";
import { MAX_POSTER_HISTORY, posterKinds, spacerSizes, type LandingSection } from "./types";
import { benefitIconNames } from "./icons";
import { BenefitIcon } from "./blocks";
import { startImageEnhance, startPosterImage } from "@/features/ai/actions";
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

type Poster = Extract<LandingSection, { type: "poster" }>;

// A designed marketing image: its texts, the AI regeneration panel (background, instructions, own prompt,
// reference) and the previous versions to restore. A merchant can also upload their own designed image.
function PosterFields({ lang, pageId, section, set, t }: { lang: string; pageId: string; section: Poster; set: (patch: Partial<Poster>) => void; t: EditorText }) {
  const pt = t.landingPages.editor.poster;
  const task = useAiTask<{ url: string }>(lang, t.errors as Record<string, string>);
  const [open, setOpen] = useState(!section.image);
  const [background, setBackground] = useState("");
  const [extra, setExtra] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [custom, setCustom] = useState("");
  const [reference, setReference] = useState<"current" | "product">(section.image ? "current" : "product");
  // A new image keeps the old ones (newest first) so they can be restored
  const replace = (image: string) => set({ image, previous: [section.image, ...section.previous].filter(Boolean).slice(0, MAX_POSTER_HISTORY) });
  return (
    <div className="space-y-3" data-testid="poster-fields">
      {section.angle && (
        <p className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent" data-testid="poster-angle">
          {pt.angle}: {section.angle}
        </p>
      )}
      {section.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={section.image} alt="" className="mx-auto max-h-72 rounded-lg border border-line" />
      )}
      <Field label={pt.kind}>
        <Select value={section.kind} onChange={(e) => set({ kind: e.target.value as Poster["kind"] })} aria-label={pt.kind}>
          {posterKinds.map((k) => (
            <option key={k} value={k}>
              {pt.kinds[k]}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-xs text-muted">{pt.textsHint}</p>
      <Field label={pt.headline}>
        <Input value={section.headline} maxLength={160} onChange={(e) => set({ headline: e.target.value })} aria-label={pt.headline} />
      </Field>
      <Field label={pt.subtitle}>
        <Input value={section.subtitle ?? ""} maxLength={240} onChange={(e) => set({ subtitle: e.target.value })} aria-label={pt.subtitle} />
      </Field>
      <Field label={pt.bullets}>
        <Textarea rows={3} value={section.bullets.join("\n")} onChange={(e) => set({ bullets: lines(e.target.value).slice(0, 5) })} aria-label={pt.bullets} />
      </Field>

      <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3" data-testid="poster-regenerate">
        <button type="button" className="flex w-full items-center gap-2 text-sm font-bold text-accent" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Sparkles size={16} /> {pt.regenerate}
        </button>
        {open && (
          <>
            <Field label={pt.reference}>
              <Select value={reference} onChange={(e) => setReference(e.target.value as typeof reference)} aria-label={pt.reference} disabled={!section.image}>
                <option value="current">{pt.refCurrent}</option>
                <option value="product">{pt.refProduct}</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
              {pt.useCustom}
            </label>
            {useCustom ? (
              <Field label={pt.custom}>
                <Textarea rows={5} maxLength={4000} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label={pt.custom} />
              </Field>
            ) : (
              <>
                <Field label={pt.background}>
                  <Input value={background} maxLength={600} placeholder={pt.backgroundPlaceholder} onChange={(e) => setBackground(e.target.value)} aria-label={pt.background} />
                </Field>
                <Field label={pt.extra}>
                  <Textarea rows={2} maxLength={1000} value={extra} placeholder={pt.extraPlaceholder} onChange={(e) => setExtra(e.target.value)} aria-label={pt.extra} />
                </Field>
              </>
            )}
            <p className="text-xs text-muted">{pt.cost}</p>
            <Button
              disabled={task.working || !section.headline.trim() || (useCustom && !custom.trim())}
              onClick={async () => {
                const result = await task.run(() =>
                  startPosterImage(lang, {
                    pageId,
                    kind: section.kind,
                    headline: section.headline,
                    subtitle: section.subtitle,
                    bullets: section.bullets,
                    scene: section.scene,
                    background,
                    extra,
                    custom: useCustom ? custom : undefined,
                    current: reference === "current" && section.image ? section.image : undefined,
                  }),
                );
                if (result) replace(result.url);
              }}
              data-testid="poster-generate"
            >
              {task.working ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} {task.working ? pt.generating : pt.generate}
            </Button>
            {task.error && <p className="text-xs text-danger">{task.error}</p>}
          </>
        )}
      </div>

      {section.previous.length > 0 && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
          onClick={() => set({ image: section.previous[0], previous: [section.image, ...section.previous.slice(1)].filter(Boolean).slice(0, MAX_POSTER_HISTORY) })}
          data-testid="poster-restore"
        >
          <RotateCcw size={15} /> {pt.restore}
        </button>
      )}
      <Field label={pt.upload}>
        <ImageManager t={t.media} value={[]} onChange={(imgs) => imgs[0] && replace(imgs[0])} max={1} />
      </Field>
    </div>
  );
}

// The fields of one section. `set` merges changes into the section.
export function SectionFields({ lang, pageId, section, set, productImages, t }: { lang: string; pageId: string; section: LandingSection; set: (patch: Partial<LandingSection>) => void; productImages: string[]; t: EditorText }) {
  const ed = t.landingPages.editor;
  const f = ed.fields;
  const p = (patch: Record<string, unknown>) => set(patch as Partial<LandingSection>);
  const titleField = (value: string | undefined, label = f.title) => <Field label={label}><Input value={value ?? ""} maxLength={200} onChange={(e) => p({ title: e.target.value })} /></Field>;

  switch (section.type) {
    case "poster":
      return <PosterFields lang={lang} pageId={pageId} section={section} set={(patch) => p(patch)} t={t} />;
    case "marquee":
      return (
        <Field label={f.items}>
          <Textarea rows={4} value={section.items.join("\n")} onChange={(e) => p({ items: lines(e.target.value).slice(0, 6) })} />
        </Field>
      );
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
                  <IconPicker value={item.icon} label={f.icon} onChange={(icon) => update({ icon })} />
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
            <button type="button" className={addButton} onClick={() => p({ items: [...section.items, { icon: "sparkles", title: "", text: "" }] })}>
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
    case "announcement":
      return (
        <Field label={f.announcement}>
          <Input value={section.text} maxLength={160} onChange={(e) => p({ text: e.target.value })} data-field="announcement" />
        </Field>
      );
    case "spacer":
      return (
        <div className="space-y-3">
          <Field label={f.spacerSize}>
            <Select value={section.size} onChange={(e) => p({ size: e.target.value })}>
              {spacerSizes.map((s) => (
                <option key={s} value={s}>
                  {f.spacerSizes[s]}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={section.line} onChange={(e) => p({ line: e.target.checked })} className="size-4 accent-[var(--color-accent)]" />
            {f.spacerLine}
          </label>
        </div>
      );
  }
}

// The icon of a benefit card: a button showing the current icon, opening a grid of the available ones
function IconPicker({ value, label, onChange }: { value: string; label: string; onChange: (icon: string) => void }) {
  return (
    <details className="relative shrink-0" data-testid="icon-picker">
      <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-[10px] border border-field-line bg-field text-accent hover:border-muted/50" aria-label={label} title={label}>
        <BenefitIcon name={value} size={18} />
      </summary>
      <div className="absolute start-0 top-11 z-20 grid w-64 grid-cols-6 gap-1 rounded-xl border border-line bg-panel p-2 shadow-lg">
        {benefitIconNames.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={value === name}
            className={`flex size-9 items-center justify-center rounded-lg ${value === name ? "bg-accent text-accent-fg" : "text-fg hover:bg-panel-2"}`}
            onClick={(e) => {
              onChange(name);
              e.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <BenefitIcon name={name} size={17} />
          </button>
        ))}
      </div>
    </details>
  );
}
