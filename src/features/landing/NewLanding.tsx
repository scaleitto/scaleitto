"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Image as ImageIcon, LayoutTemplate, Link2, LoaderCircle, Package, PenLine, Sparkles, WandSparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { checkAiLanding, startAiLanding, type AiCheckResult, type AiStartInput } from "./ai-actions";
import { pageLanguages } from "./types";
import { imageStyles as imageStyleKeys } from "@/lib/enums";

export type NewLandingText = Pick<Dictionary, "landingPages" | "media" | "errors" | "common">;
type Product = { id: string; name: string };
type Source = "product" | "photos" | "link";
type Mode = "ai" | "manual";
type PageStyle = "images" | "sections";
type Poster = NonNullable<AiStartInput["poster"]>;

const POLL_MS = 3000;
const GIVE_UP_MS = 12 * 60_000;
const counts = [2, 4, 6, 8, 10] as const;
const peopleKeys = ["none", "hands", "people"] as const;
const audienceKeys = ["neutral", "women", "men", "kids", "family"] as const;
const toNumber = (v: string) => (v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "")) : null);

// Two or three big choice buttons
function Choice<T extends string>({ value, options, onChange, testId }: { value: T; options: { key: T; icon: typeof Package; title: string; hint?: string }[]; onChange: (v: T) => void; testId: string }) {
  return (
    <div className={`grid gap-2 ${options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`} data-testid={testId}>
      {options.map(({ key, icon: Icon, title, hint }) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`flex items-start gap-3 rounded-xl border p-3 text-start transition ${value === key ? "border-accent bg-accent/10 ring-2 ring-accent/20" : "border-line hover:bg-panel-2"}`}
        >
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${value === key ? "bg-accent text-accent-fg" : "bg-panel-2 text-muted"}`}>
            <Icon size={18} />
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-bold ${value === key ? "text-accent" : ""}`}>{title}</span>
            {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs text-accent-fg">{n}</span> {title}
      </h3>
      {children}
    </section>
  );
}

function ManualForm({ lang, products, pageStyle, action, t }: { lang: string; products: Product[]; pageStyle: PageStyle; action: (s: ActionState, f: FormData) => Promise<ActionState>; t: NewLandingText }) {
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="manual-create">
      <FormMessage state={state} errors={e} />
      <input type="hidden" name="pageStyle" value={pageStyle} />
      {pageStyle === "images" && <Alert variant="info">{t.landingPages.wizard.manualImagesHint}</Alert>}
      {products.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.landingPages.product} htmlFor="m-product" error={fieldError(state, e, "productId")}>
              <Select id="m-product" name="productId" defaultValue={products[0].id}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.landingPages.language} htmlFor="m-language">
              <Select id="m-language" name="language" defaultValue={lang === "fr" ? "fr" : lang === "en" ? "en" : "ar"}>
                {pageLanguages.map((l) => (
                  <option key={l} value={l}>
                    {t.landingPages.languages[l]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <SubmitButton pending={pending} pendingText={t.common.loading}>
            {t.landingPages.create}
          </SubmitButton>
        </>
      ) : (
        <p className="text-sm text-muted">{t.landingPages.noProducts}</p>
      )}
    </form>
  );
}

// One page for both ways of creating a landing page: the AI writes (and designs) it, or a ready template
// is created by hand. The same choices (page style, language…) apply to both.
export function NewLanding({
  lang,
  products,
  editorBase,
  createAction,
  aiLeft,
  shopColor,
  t,
}: {
  lang: string;
  products: Product[];
  editorBase: string;
  createAction: (s: ActionState, f: FormData) => Promise<ActionState>;
  // AI uses left this month (null = unlimited)
  aiLeft: number | null;
  shopColor: string;
  t: NewLandingText;
}) {
  const lp = t.landingPages;
  const ai = lp.ai;
  const w = lp.wizard;
  const e = t.errors as Record<string, string>;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ai");
  const [pageStyle, setPageStyle] = useState<PageStyle>("images");
  const [source, setSource] = useState<Source>(products.length ? "product" : "photos");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [language, setLanguage] = useState<(typeof pageLanguages)[number]>(lang === "fr" ? "fr" : lang === "en" ? "en" : "dz");
  const [tone, setTone] = useState<AiStartInput["tone"]>("persuasive");
  const [audienceText, setAudienceText] = useState("");
  const [notes, setNotes] = useState("");
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [enhance, setEnhance] = useState(true);
  const [style, setStyle] = useState<(typeof imageStyleKeys)[number]>("studio");
  const [enhanceCount, setEnhanceCount] = useState(1);
  const [poster, setPoster] = useState<Poster>({ count: 8, people: "hands", audience: "neutral", color: null });
  const [colorMode, setColorMode] = useState<"auto" | "store" | "custom">("auto");
  const [customColor, setCustomColor] = useState(shopColor);
  const [phase, setPhase] = useState<"form" | "confirm" | "working">("form");
  const [progress, setProgress] = useState<{ step: "text" | "images"; done: number; total: number }>({ step: "text", done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const [generationId, setGenerationId] = useState<string | null>(null);

  // While working: ask the server every few seconds (each check is a short request)
  useEffect(() => {
    if (!generationId) return;
    let stopped = false;
    const tick = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    const poll = async () => {
      while (!stopped) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (stopped) return;
        const r: AiCheckResult = await checkAiLanding(lang, generationId).catch((): AiCheckResult => ({ state: "pending" }));
        if (r.state === "pending" && r.step === "images") setProgress({ step: "images", done: r.done ?? 0, total: r.total ?? 0 });
        if (r.state === "done") {
          router.push(`${editorBase}/${r.pageId}`);
          return;
        }
        if (r.state === "failed" || Date.now() - startedAt.current > GIVE_UP_MS) {
          setError(r.state === "failed" ? `${e[r.error] ?? e.unexpected}${r.message ? `: ${r.message}` : ""}` : e.aiFailed);
          setGenerationId(null);
          setPhase("form");
          return;
        }
      }
    };
    poll();
    return () => {
      stopped = true;
      window.clearInterval(tick);
    };
  }, [generationId, lang, editorBase, router, e]);

  const images = pageStyle === "images";
  const color = colorMode === "auto" ? null : colorMode === "store" ? shopColor : customColor;
  // The plan (or the page text) + one per designed image / reworked photo
  const cost = 1 + (images ? poster.count : enhance ? enhanceCount : 0);
  const enough = aiLeft === null || aiLeft >= cost;

  async function generate() {
    setError(null);
    setFieldErrors({});
    setPhase("working");
    setProgress({ step: "text", done: 0, total: 0 });
    setElapsed(0);
    startedAt.current = Date.now();
    const r = await startAiLanding(lang, {
      source,
      productId: source === "product" ? productId : undefined,
      photos: source === "photos" ? photos : undefined,
      url: source === "link" ? url : undefined,
      name: source === "product" ? undefined : name,
      price: source === "product" ? undefined : toNumber(price),
      compareAtPrice: source === "product" ? undefined : toNumber(compareAt),
      notes,
      audience: images ? "" : audienceText,
      language,
      tone,
      extraPhotos: source === "photos" ? [] : extraPhotos,
      enhance: !images && enhance ? { style, count: enhanceCount } : null,
      pageStyle,
      poster: images ? { ...poster, color } : undefined,
    }).catch(() => ({ ok: false as const, error: "unexpected" }));
    if (r.ok) setGenerationId(r.generationId);
    else {
      setPhase("form");
      setFieldErrors(("fieldErrors" in r && r.fieldErrors) || {});
      setError(`${e[r.error] ?? e.unexpected}${"message" in r && r.message ? `: ${r.message}` : ""}`);
    }
  }

  if (phase === "working") {
    const steps = images ? w.imageSteps : enhance ? [...ai.steps, ai.stepImages] : ai.steps;
    const step = progress.step === "images" ? steps.length - 1 : Math.min(elapsed < 15 ? 0 : elapsed < 40 ? 1 : elapsed < 70 ? 2 : 3, steps.length - (images || enhance ? 2 : 1));
    return (
      <Card className="flex flex-col items-center gap-5 py-12 text-center" data-testid="ai-working">
        <div className="relative">
          <Sparkles size={44} className="text-accent" />
          <LoaderCircle size={72} className="absolute -inset-3.5 animate-spin text-accent/30" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{ai.working}</h2>
          <p className="mt-1 text-sm text-muted">{ai.workingHint}</p>
        </div>
        <ol className="space-y-2 text-start text-sm">
          {steps.map((label, i) => (
            <li key={label} className={`flex items-center gap-2 ${i < step ? "text-accent" : i === step ? "text-fg" : "text-muted/60"}`}>
              {i < step ? <Check size={16} /> : i === step ? <LoaderCircle size={16} className="animate-spin" /> : <span className="size-4" />}
              {label}
            </li>
          ))}
        </ol>
        {progress.step === "images" && progress.total > 0 && (
          <div className="w-64 space-y-1" data-testid="image-progress">
            <p className="text-sm font-semibold">{fmt(w.designing, { done: progress.done, total: progress.total })}</p>
            <div className="h-2 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
          </div>
        )}
        <p className="text-xs text-muted">{fmt(ai.elapsed, { s: elapsed })}</p>
        {elapsed > 240 && <p className="text-xs text-warning">{ai.slow}</p>}
      </Card>
    );
  }

  if (phase === "confirm") {
    const productName = source === "product" ? products.find((p) => p.id === productId)?.name : name || "—";
    const rows: [string, string][] = [
      [w.summary.source, ai.sources[source]],
      [w.summary.product, productName ?? "—"],
      ...(source !== "product" && price ? ([[w.summary.price, `${price} ${t.common.currency}`]] as [string, string][]) : []),
      [w.summary.language, lp.languages[language]],
      [w.summary.style, w.styles[pageStyle].title],
      ...(images
        ? ([
            [w.summary.count, String(poster.count)],
            [w.summary.people, w.peoples[poster.people]],
            [w.summary.audience, w.audiences[poster.audience]],
            [w.summary.colors, colorMode === "auto" ? w.colorAuto : (color ?? "")],
          ] as [string, string][])
        : ([[w.summary.tone, ai.tones[tone]]] as [string, string][])),
    ];
    return (
      <Card className="mx-auto max-w-2xl space-y-5" data-testid="ai-confirm">
        <h2 className="text-lg font-bold">{w.confirmTitle}</h2>
        <dl className="divide-y divide-line rounded-xl border border-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold" dir="auto">
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <div className={`rounded-xl p-4 text-sm ${enough ? "bg-accent/10" : "bg-danger/10"}`} data-testid="ai-cost">
          <p className="font-bold">{fmt(w.cost, { n: cost })}</p>
          <p className="text-muted">{fmt(w.left, { n: aiLeft === null ? w.unlimited : aiLeft })}</p>
          {!enough && <p className="mt-1 font-semibold text-danger">{w.notEnough}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setPhase("form")}>
            {w.back}
          </Button>
          <Button onClick={generate} disabled={!enough}>
            <Sparkles size={16} /> {w.confirm}
          </Button>
        </div>
      </Card>
    );
  }

  const err = (f: string) => (fieldErrors[f] ? (e[fieldErrors[f]] ?? e.invalid) : undefined);
  const sources: { key: Source; icon: typeof Package; title: string }[] = [
    { key: "product", icon: Package, title: ai.sources.product },
    { key: "photos", icon: ImageIcon, title: ai.sources.photos },
    { key: "link", icon: Link2, title: ai.sources.link },
  ];
  return (
    <Card className="space-y-6" data-testid="ai-wizard">
      <Choice<Mode>
        testId="mode"
        value={mode}
        onChange={setMode}
        options={[
          { key: "ai", icon: WandSparkles, title: lp.withAi, hint: w.modeAiHint },
          { key: "manual", icon: PenLine, title: lp.manual, hint: w.modeManualHint },
        ]}
      />
      {error && <Alert>{error}</Alert>}

      <Step n={1} title={w.pageStyle}>
        <Choice<PageStyle>
          testId="page-style"
          value={pageStyle}
          onChange={setPageStyle}
          options={[
            { key: "images", icon: ImageIcon, title: w.styles.images.title, hint: w.styles.images.hint },
            { key: "sections", icon: LayoutTemplate, title: w.styles.sections.title, hint: w.styles.sections.hint },
          ]}
        />
      </Step>

      {mode === "manual" ? (
        <Step n={2} title={lp.product}>
          <ManualForm lang={lang} products={products} pageStyle={pageStyle} action={createAction} t={t} />
        </Step>
      ) : (
        <>
          <Step n={2} title={ai.source}>
            <Choice<Source> testId="source" value={source} onChange={setSource} options={sources} />
            <p className="text-xs text-muted">{ai.sourceHints[source]}</p>
            {source === "product" ? (
              <Field label={lp.product} htmlFor="ai-product" error={err("productId")}>
                {products.length ? (
                  <Select id="ai-product" value={productId} onChange={(ev) => setProductId(ev.target.value)}>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-sm text-muted">{lp.noProducts}</p>
                )}
              </Field>
            ) : (
              <div className="space-y-4">
                {source === "photos" ? (
                  <Field label={ai.photos} error={err("photos")}>
                    <ImageManager t={t.media} value={photos} onChange={setPhotos} max={8} />
                  </Field>
                ) : (
                  <Field label={ai.url} htmlFor="ai-url">
                    <Input id="ai-url" dir="ltr" placeholder="https://…" value={url} onChange={(ev) => setUrl(ev.target.value)} />
                  </Field>
                )}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={ai.productName} htmlFor="ai-name" hint={ai.productNameHint}>
                    <Input id="ai-name" value={name} maxLength={200} onChange={(ev) => setName(ev.target.value)} />
                  </Field>
                  <Field label={`${ai.price} (${t.common.currency})`} htmlFor="ai-price" error={err("price")}>
                    <Input id="ai-price" inputMode="numeric" dir="ltr" value={price} onChange={(ev) => setPrice(ev.target.value)} />
                  </Field>
                  <Field label={ai.compareAtPrice} htmlFor="ai-compare">
                    <Input id="ai-compare" inputMode="numeric" dir="ltr" value={compareAt} onChange={(ev) => setCompareAt(ev.target.value)} />
                  </Field>
                </div>
              </div>
            )}
            {source !== "photos" && (
              <Field label={ai.extraPhotos} hint={ai.extraPhotosHint}>
                <ImageManager t={t.media} value={extraPhotos} onChange={setExtraPhotos} max={8} />
              </Field>
            )}
          </Step>

          <Step n={3} title={w.styles[pageStyle].title}>
            {images ? (
              <div className="grid gap-4 sm:grid-cols-2" data-testid="poster-options">
                <Field label={w.count} htmlFor="ai-count">
                  <Select id="ai-count" value={poster.count} onChange={(ev) => setPoster({ ...poster, count: Number(ev.target.value) as Poster["count"] })}>
                    {counts.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={w.people} htmlFor="ai-people">
                  <Select id="ai-people" value={poster.people} onChange={(ev) => setPoster({ ...poster, people: ev.target.value as Poster["people"] })}>
                    {peopleKeys.map((k) => (
                      <option key={k} value={k}>
                        {w.peoples[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={w.audience} htmlFor="ai-audience-kind">
                  <Select id="ai-audience-kind" value={poster.audience} onChange={(ev) => setPoster({ ...poster, audience: ev.target.value as Poster["audience"] })}>
                    {audienceKeys.map((k) => (
                      <option key={k} value={k}>
                        {w.audiences[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={w.colors} htmlFor="ai-colors">
                  <div className="flex gap-2">
                    <Select id="ai-colors" value={colorMode} onChange={(ev) => setColorMode(ev.target.value as typeof colorMode)}>
                      <option value="auto">{w.colorAuto}</option>
                      <option value="store">{w.colorStore}</option>
                      <option value="custom">{w.colorCustom}</option>
                    </Select>
                    {colorMode === "custom" && (
                      <input type="color" aria-label={w.colorCustom} value={customColor} onChange={(ev) => setCustomColor(ev.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-panel p-1" />
                    )}
                  </div>
                </Field>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3 rounded-lg border border-line p-4" data-testid="ai-enhance">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={enhance} onChange={(ev) => setEnhance(ev.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
                    <span>
                      <span className="font-semibold">{ai.enhance}</span>
                      <span className="block text-xs text-muted">{ai.enhanceHint}</span>
                    </span>
                  </label>
                  {enhance && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={ai.enhanceStyle} htmlFor="ai-style">
                        <Select id="ai-style" value={style} onChange={(ev) => setStyle(ev.target.value as typeof style)}>
                          {imageStyleKeys.map((k) => (
                            <option key={k} value={k}>
                              {lp.editor.fields.styles[k]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={ai.enhanceCount} htmlFor="ai-enhance-count">
                        <Select id="ai-enhance-count" value={enhanceCount} onChange={(ev) => setEnhanceCount(Number(ev.target.value))}>
                          <option value={1}>{ai.enhanceOne}</option>
                          <option value={2}>{ai.enhanceTwo}</option>
                        </Select>
                      </Field>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={ai.tone} htmlFor="ai-tone">
                    <Select id="ai-tone" value={tone} onChange={(ev) => setTone(ev.target.value as AiStartInput["tone"])}>
                      {(Object.keys(ai.tones) as (keyof typeof ai.tones)[]).map((k) => (
                        <option key={k} value={k}>
                          {ai.tones[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={ai.audience} htmlFor="ai-audience">
                    <Input id="ai-audience" maxLength={300} placeholder={ai.audiencePlaceholder} value={audienceText} onChange={(ev) => setAudienceText(ev.target.value)} />
                  </Field>
                </div>
              </div>
            )}
          </Step>

          <Step n={4} title={lp.language}>
            <Field label={lp.language} htmlFor="ai-language">
              <Select id="ai-language" value={language} onChange={(ev) => setLanguage(ev.target.value as typeof language)}>
                {pageLanguages.map((l) => (
                  <option key={l} value={l}>
                    {lp.languages[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={ai.notes} htmlFor="ai-notes" hint={ai.notesHint}>
              <Textarea id="ai-notes" rows={4} maxLength={3000} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
            </Field>
            <p className="text-xs text-muted">{ai.honesty}</p>
          </Step>

          <div className="flex justify-end">
            <Button onClick={() => setPhase("confirm")} disabled={source === "product" && !products.length} data-testid="ai-next">
              {w.next}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
