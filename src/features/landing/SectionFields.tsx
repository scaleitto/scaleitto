"use client";

import { useRef, useState } from "react";
import { Images, LoaderCircle, Plus, RefreshCw, Sparkles, Trash2, Undo2, Upload, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Alert, Button, Field, Input, Select, Textarea } from "@/ui";
import { uploadOne } from "@/ui/ImageManager";
import { useModal } from "@/ui/useModal";
import { startImageEdit, startPosterImage } from "@/features/ai/actions";
import { useAiTask } from "@/features/ai/useAiTask";
import { badgeIconOf } from "./blocks";
import { badgeIcons, bulletStyles, imageFits, MAX_POSTER_HISTORY, textAligns, textSizes, type LandingSection } from "./types";

export type EditorText = Pick<Dictionary, "landingPages" | "media" | "errors" | "common">;
type Props = {
  lang: string;
  pageId: string;
  section: LandingSection;
  set: (patch: Partial<LandingSection>) => void;
  library: string[];
  t: EditorText;
};

const label = "text-[11px] font-semibold tracking-wide text-muted uppercase";
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

// "Drop image here, or click to browse" + "Pick from library"
function ImageSource({ value, onChange, library, t }: { value: string; onChange: (url: string) => void; library: string[]; t: EditorText }) {
  const f = t.landingPages.editor.fields;
  const input = useRef<HTMLInputElement>(null);
  const dialog = useModal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const upload = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const r = await uploadOne(file);
    setBusy(false);
    if ("url" in r) onChange(r.url);
    else setError(t.media.errors[r.error]);
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files[0]);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-sm text-muted transition ${over ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50"}`}
        data-testid="image-drop"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="max-h-32 rounded-md object-contain" />
        ) : busy ? (
          <LoaderCircle size={20} className="animate-spin" />
        ) : (
          <Upload size={20} />
        )}
        {busy ? f.uploading : f.upload}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} data-testid="image-file" />
      <Button type="button" variant="secondary" className="w-full" onClick={() => dialog.current?.showModal()} data-testid="pick-library">
        <Images size={15} /> {f.library}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      <dialog ref={dialog} className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="library">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-bold">{f.libraryTitle}</h2>
          <button type="button" aria-label={t.common.cancel} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => dialog.current?.close()}>
            <X size={18} />
          </button>
        </div>
        <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto p-4 sm:grid-cols-4">
          {library.length === 0 && <p className="col-span-full text-sm text-muted">{f.libraryEmpty}</p>}
          {library.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                onChange(src);
                dialog.current?.close();
              }}
              className={`aspect-square overflow-hidden rounded-lg border-2 ${src === value ? "border-accent" : "border-line hover:border-accent/50"}`}
              data-library-image
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}

function ImageFields({ lang, pageId, section: s, set, library, t }: Props & { section: Extract<LandingSection, { type: "image" }> }) {
  const f = t.landingPages.editor.fields;
  const errors = t.errors as Record<string, string>;
  const task = useAiTask<{ url: string }>(lang, errors);
  const [instruction, setInstruction] = useState("");
  const [poster, setPoster] = useState({ headline: s.poster?.headline ?? "", subtitle: s.poster?.subtitle ?? "", bullets: (s.poster?.bullets ?? []).join("\n") });
  // A new image keeps the one it replaces to restore it (AI images only)
  const replace = (url: string) => set({ url, ...(s.poster ? { poster: { ...s.poster, ...posterTexts(), previous: [s.url, ...s.poster.previous].filter(Boolean).slice(0, MAX_POSTER_HISTORY) } } : {}) });
  const posterTexts = () => ({ headline: poster.headline.trim() || s.poster?.headline || "", subtitle: poster.subtitle.trim() || undefined, bullets: lines(poster.bullets).slice(0, 5) });
  const ownImage = s.url.startsWith("/uploads/");
  return (
    <div className="space-y-4">
      <ImageSource value={s.url} onChange={(url) => replace(url)} library={library} t={t} />

      {s.poster && (
        <div className="space-y-3 rounded-xl border border-line p-3" data-testid="poster-fields">
          <p className={label}>{f.poster}</p>
          <p className="text-xs text-muted">{f.posterHint}</p>
          <Field label={f.headline}>
            <Input value={poster.headline} maxLength={160} onChange={(e) => setPoster({ ...poster, headline: e.target.value })} />
          </Field>
          <Field label={f.subtitle}>
            <Input value={poster.subtitle} maxLength={240} onChange={(e) => setPoster({ ...poster, subtitle: e.target.value })} />
          </Field>
          <Field label={f.posterBullets}>
            <Textarea rows={3} value={poster.bullets} onChange={(e) => setPoster({ ...poster, bullets: e.target.value })} />
          </Field>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={task.working || !poster.headline.trim()}
            data-testid="draw-again"
            onClick={async () => {
              const r = await task.run(() => startPosterImage(lang, { pageId, ...posterTexts(), subtitle: poster.subtitle.trim() || undefined, scene: s.poster?.scene }));
              if (r?.url) replace(r.url);
            }}
          >
            {task.working ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />} {task.working ? f.aiWorking : f.drawAgain}
          </Button>
          {s.poster.previous.length > 0 && (
            <button type="button" className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline" onClick={() => set({ url: s.poster!.previous[0], poster: { ...s.poster!, previous: [s.url, ...s.poster!.previous.slice(1)].filter(Boolean).slice(0, MAX_POSTER_HISTORY) } })} data-testid="restore-image">
              <Undo2 size={13} /> {f.restore}
            </button>
          )}
        </div>
      )}

      {ownImage && (
        <div className="space-y-2 rounded-xl border border-accent/30 bg-accent-soft/50 p-3" data-testid="ai-edit">
          <p className="flex items-center justify-between">
            <span className={label}>{f.aiEdit}</span>
            <span className="rounded-full border border-warning/40 bg-warning-soft px-2 text-[10px] font-bold text-warning uppercase">{t.landingPages.editor.improve.beta}</span>
          </p>
          <p className="text-xs text-muted">{f.aiEditHint}</p>
          <Textarea rows={3} value={instruction} maxLength={600} onChange={(e) => setInstruction(e.target.value)} placeholder={f.aiEditPlaceholder} />
          <Button
            type="button"
            className="w-full"
            disabled={task.working || instruction.trim().length < 3}
            onClick={async () => {
              const r = await task.run(() => startImageEdit(lang, { pageId, current: s.url, instruction, poster: Boolean(s.poster) }));
              if (r?.url) {
                replace(r.url);
                setInstruction("");
              }
            }}
          >
            {task.working ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} {task.working ? f.aiWorking : f.aiEditGo}
          </Button>
        </div>
      )}
      {(s.poster || ownImage) && <p className="text-[11px] text-muted">{f.aiCost}</p>}
      {task.error && <Alert>{task.error}</Alert>}

      <Field label={f.fit}>
        <Select value={s.fit} onChange={(e) => set({ fit: e.target.value as typeof s.fit })} data-field="fit">
          {imageFits.map((k) => (
            <option key={k} value={k}>
              {f.fits[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={f.margin}>
        <Input type="number" min={0} max={120} value={s.margin} onChange={(e) => set({ margin: Number(e.target.value) || 0 })} data-field="margin" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={f.borderWidth}>
          <Input type="number" min={0} max={20} value={s.borderWidth} onChange={(e) => set({ borderWidth: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={f.radius}>
          <Input type="number" min={0} max={60} value={s.radius} onChange={(e) => set({ radius: Number(e.target.value) || 0 })} data-field="radius" />
        </Field>
      </div>
      <Field label={f.borderColor}>
        <input type="color" aria-label={f.borderColor} value={s.borderColor || "#e2e8f0"} onChange={(e) => set({ borderColor: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-line bg-field p-1" />
      </Field>
    </div>
  );
}

// The settings of the selected component (Zimam's right panel)
export function SectionFields(props: Props) {
  const { section: s, set, t } = props;
  const f = t.landingPages.editor.fields;
  switch (s.type) {
    case "image":
      return <ImageFields {...props} section={s} />;
    case "text":
      return (
        <div className="space-y-3">
          <Field label={f.title}>
            <Input value={s.title ?? ""} maxLength={200} onChange={(e) => set({ title: e.target.value })} data-field="title" />
          </Field>
          <Field label={f.body}>
            <Textarea rows={6} value={s.body} maxLength={3000} onChange={(e) => set({ body: e.target.value })} data-field="body" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={f.align}>
              <Select value={s.align} onChange={(e) => set({ align: e.target.value as typeof s.align })}>
                {textAligns.map((k) => (
                  <option key={k} value={k}>
                    {f.aligns[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={f.size}>
              <Select value={s.size} onChange={(e) => set({ size: e.target.value as typeof s.size })}>
                {textSizes.map((k) => (
                  <option key={k} value={k}>
                    {f.sizes[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      );
    case "form":
      return (
        <div className="space-y-2">
          <p className={label}>{t.landingPages.editor.types.form}</p>
          <Field label={f.formStyle}>
            <Select value="store" disabled data-testid="landing-form-style">
              <option value="store">{f.storeTheme}</option>
            </Select>
          </Field>
        </div>
      );
    case "sticky":
      return (
        <Field label={f.label} hint={f.labelHint}>
          <Input value={s.label} maxLength={60} onChange={(e) => set({ label: e.target.value })} data-field="label" />
        </Field>
      );
    case "thankYou":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted">{f.thankHint}</p>
          <Field label={f.thankTitle}>
            <Input value={s.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} data-field="thank-title" />
          </Field>
          <Field label={f.thankMessage}>
            <Textarea rows={4} value={s.message} maxLength={600} onChange={(e) => set({ message: e.target.value })} data-field="thank-message" />
          </Field>
        </div>
      );
    case "countdown":
      return (
        <div className="space-y-3">
          <Field label={f.title}>
            <Input value={s.title ?? ""} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={f.endsAt} hint={f.countdownHint}>
            <Input type="datetime-local" value={toLocalInput(s.endsAt)} onChange={(e) => e.target.value && set({ endsAt: new Date(e.target.value).toISOString() })} data-field="endsAt" />
          </Field>
        </div>
      );
    case "reviews":
      return (
        <div className="space-y-3">
          <p className="text-xs text-warning">{f.reviewsHint}</p>
          <Field label={f.title}>
            <Input value={s.title ?? ""} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          {s.items.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-line p-2.5" data-review={i}>
              <div className="flex gap-2">
                <Input aria-label={f.name} placeholder={f.name} value={r.name} maxLength={80} onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <Select aria-label={f.rating} value={r.rating} className="w-20" onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, rating: Number(e.target.value) } : x)) })}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}★
                    </option>
                  ))}
                </Select>
                <button type="button" aria-label={f.remove} className="rounded p-1.5 text-muted hover:text-danger" onClick={() => set({ items: s.items.filter((_, j) => j !== i) })}>
                  <Trash2 size={15} />
                </button>
              </div>
              <Textarea aria-label={f.review} placeholder={f.review} rows={2} value={r.text} maxLength={800} onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            </div>
          ))}
          <Button type="button" variant="secondary" disabled={s.items.length >= 20} onClick={() => set({ items: [...s.items, { name: "", text: "", rating: 5 }] })} data-testid="add-review">
            <Plus size={14} /> {f.addReview}
          </Button>
        </div>
      );
    case "badges":
      return (
        <div className="space-y-3">
          {s.items.map((b, i) => {
            const Icon = badgeIconOf[b.icon];
            return (
              <div key={i} className="flex items-center gap-2" data-badge={i}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-panel-2 text-fg-2">
                  <Icon size={16} />
                </span>
                <Select aria-label={f.badgeIcon} value={b.icon} className="w-28" onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, icon: e.target.value as typeof b.icon } : x)) })}>
                  {badgeIcons.map((k) => (
                    <option key={k} value={k}>
                      {f.icons[k]}
                    </option>
                  ))}
                </Select>
                <Input aria-label={f.badgeText} value={b.text} maxLength={60} onChange={(e) => set({ items: s.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                <button type="button" aria-label={f.remove} className="rounded p-1.5 text-muted hover:text-danger" onClick={() => set({ items: s.items.filter((_, j) => j !== i) })}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          <Button type="button" variant="secondary" disabled={s.items.length >= 6} onClick={() => set({ items: [...s.items, { icon: "check", text: "" }] })}>
            <Plus size={14} /> {f.addBadge}
          </Button>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-3">
          <Field label={f.title}>
            <Input value={s.title ?? ""} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          {s.items.map((x, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-line p-2.5" data-faq={i}>
              <div className="flex gap-2">
                <Input aria-label={f.question} placeholder={f.question} value={x.q} maxLength={300} onChange={(e) => set({ items: s.items.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)) })} />
                <button type="button" aria-label={f.remove} className="rounded p-1.5 text-muted hover:text-danger" onClick={() => set({ items: s.items.filter((_, j) => j !== i) })}>
                  <Trash2 size={15} />
                </button>
              </div>
              <Textarea aria-label={f.answer} placeholder={f.answer} rows={2} value={x.a} maxLength={1500} onChange={(e) => set({ items: s.items.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)) })} />
            </div>
          ))}
          <Button type="button" variant="secondary" disabled={s.items.length >= 15} onClick={() => set({ items: [...s.items, { q: "", a: "" }] })} data-testid="add-question">
            <Plus size={14} /> {f.addQuestion}
          </Button>
        </div>
      );
    case "spacer":
      return (
        <div className="space-y-3">
          <Field label={f.spacerSize}>
            <Input type="number" min={4} max={200} value={s.size} onChange={(e) => set({ size: Number(e.target.value) || 4 })} data-field="size" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.line} onChange={(e) => set({ line: e.target.checked })} className="size-4 accent-[var(--color-accent)]" /> {f.line}
          </label>
        </div>
      );
    case "bullets":
      return (
        <div className="space-y-3">
          <Field label={f.title}>
            <Input value={s.title ?? ""} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={f.items}>
            <Textarea rows={6} defaultValue={s.items.join("\n")} onChange={(e) => set({ items: lines(e.target.value).slice(0, 12) })} data-field="items" />
          </Field>
          <Field label={f.bulletStyle}>
            <Select value={s.style} onChange={(e) => set({ style: e.target.value as typeof s.style })}>
              {bulletStyles.map((k) => (
                <option key={k} value={k}>
                  {f.bulletStyles[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case "video":
      return (
        <Field label={f.videoUrl}>
          <Input dir="ltr" value={s.url} placeholder="https://youtu.be/…" onChange={(e) => set({ url: e.target.value })} data-field="url" />
        </Field>
      );
    case "announcement":
      return (
        <div className="space-y-3">
          <Field label={f.announcement}>
            <Input value={s.text} maxLength={160} onChange={(e) => set({ text: e.target.value })} data-field="text" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.scrolling} onChange={(e) => set({ scrolling: e.target.checked })} className="size-4 accent-[var(--color-accent)]" /> {f.scrolling}
          </label>
        </div>
      );
  }
}
