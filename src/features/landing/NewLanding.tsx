"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Image as ImageIcon, Link2, LoaderCircle, Package, Sparkles, WandSparkles } from "lucide-react";
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

const POLL_MS = 3000;

const GIVE_UP_MS = 10 * 60_000;
const toNumber = (v: string) => (v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "")) : null);

function AiWizard({ lang, products, editorBase, t }: { lang: string; products: Product[]; editorBase: string; t: NewLandingText }) {
  const ai = t.landingPages.ai;
  const e = t.errors as Record<string, string>;
  const router = useRouter();
  const [source, setSource] = useState<Source>(products.length ? "product" : "photos");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [language, setLanguage] = useState<(typeof pageLanguages)[number]>(lang === "fr" ? "fr" : lang === "en" ? "en" : "ar");
  const [tone, setTone] = useState<AiStartInput["tone"]>("persuasive");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [enhance, setEnhance] = useState(true);
  const [style, setStyle] = useState<(typeof imageStyleKeys)[number]>("studio");
  const [enhanceCount, setEnhanceCount] = useState(1);
  const [imagesStep, setImagesStep] = useState(false);
  const [phase, setPhase] = useState<"form" | "working">("form");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  // While working: ask the server every few seconds (each check is a short request)
  const [generationId, setGenerationId] = useState<string | null>(null);
  useEffect(() => {
    if (!generationId) return;
    let stopped = false;
    const tick = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    const poll = async () => {
      while (!stopped) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (stopped) return;
        const r: AiCheckResult = await checkAiLanding(lang, generationId).catch((): AiCheckResult => ({ state: "pending" }));
        if (r.state === "pending" && r.step === "images") setImagesStep(true);
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

  async function generate() {
    setError(null);
    setFieldErrors({});
    setPhase("working");
    setImagesStep(false);
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
      audience,
      language,
      tone,
      extraPhotos: source === "photos" ? [] : extraPhotos,
      enhance: enhance ? { style, count: enhanceCount } : null,
    }).catch(() => ({ ok: false as const, error: "unexpected" }));
    if (r.ok) setGenerationId(r.generationId);
    else {
      setPhase("form");
      setFieldErrors(("fieldErrors" in r && r.fieldErrors) || {});
      setError(`${e[r.error] ?? e.unexpected}${"message" in r && r.message ? `: ${r.message}` : ""}`);
    }
  }

  if (phase === "working") {
    // The last step is the photo work when it was asked for
    const steps = enhance ? [...ai.steps, ai.stepImages] : ai.steps;
    const step = imagesStep ? steps.length - 1 : Math.min(elapsed < 15 ? 0 : elapsed < 40 ? 1 : elapsed < 70 ? 2 : 3, enhance ? steps.length - 2 : steps.length - 1);
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
        <p className="text-xs text-muted">{fmt(ai.elapsed, { s: elapsed })}</p>
        {elapsed > 150 && <p className="text-xs text-amber-300">{ai.slow}</p>}
      </Card>
    );
  }

  const sources: { key: Source; icon: typeof Package }[] = [
    { key: "product", icon: Package },
    { key: "photos", icon: ImageIcon },
    { key: "link", icon: Link2 },
  ];
  const err = (f: string) => (fieldErrors[f] ? (e[fieldErrors[f]] ?? e.invalid) : undefined);
  return (
    <Card className="space-y-5" data-testid="ai-wizard">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <WandSparkles size={20} className="text-accent" /> {t.landingPages.withAi}
        </h2>
        <p className="mt-1 text-sm text-muted">{t.landingPages.withAiHint}</p>
      </div>
      {error && <Alert>{error}</Alert>}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{ai.source}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {sources.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={source === key}
              onClick={() => setSource(key)}
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${source === key ? "border-accent bg-accent/10 text-accent" : "border-line hover:bg-panel-2"}`}
            >
              <Icon size={16} /> {ai.sources[key]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{ai.sourceHints[source]}</p>
      </fieldset>

      {source === "product" ? (
        <Field label={t.landingPages.product} htmlFor="ai-product" error={err("productId")}>
          {products.length ? (
            <Select id="ai-product" value={productId} onChange={(ev) => setProductId(ev.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-muted">{t.landingPages.noProducts}</p>
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
                    {t.landingPages.editor.fields.styles[k]}
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
        <Field label={t.landingPages.language} htmlFor="ai-language">
          <Select id="ai-language" value={language} onChange={(ev) => setLanguage(ev.target.value as typeof language)}>
            {pageLanguages.map((l) => (
              <option key={l} value={l}>
                {t.landingPages.languages[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={ai.tone} htmlFor="ai-tone">
          <Select id="ai-tone" value={tone} onChange={(ev) => setTone(ev.target.value as AiStartInput["tone"])}>
            {(Object.keys(ai.tones) as (keyof typeof ai.tones)[]).map((k) => (
              <option key={k} value={k}>
                {ai.tones[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={ai.audience} htmlFor="ai-audience">
        <Input id="ai-audience" maxLength={300} placeholder={ai.audiencePlaceholder} value={audience} onChange={(ev) => setAudience(ev.target.value)} />
      </Field>
      <Field label={ai.notes} htmlFor="ai-notes" hint={ai.notesHint}>
        <Textarea id="ai-notes" rows={4} maxLength={3000} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
      </Field>
      <p className="text-xs text-muted">{ai.honesty}</p>
      <Button onClick={generate} disabled={source === "product" && !products.length}>
        <Sparkles size={16} /> {ai.generate}
      </Button>
    </Card>
  );
}

function ManualForm({ lang, products, action, t }: { lang: string; products: Product[]; action: (s: ActionState, f: FormData) => Promise<ActionState>; t: NewLandingText }) {
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="manual-create">
        <div>
          <h2 className="text-lg font-semibold">{t.landingPages.manual}</h2>
          <p className="mt-1 text-sm text-muted">{t.landingPages.manualHint}</p>
        </div>
        <FormMessage state={state} errors={e} />
        {products.length ? (
          <>
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
            <SubmitButton pending={pending} variant="secondary" pendingText={t.common.loading}>
              {t.landingPages.create}
            </SubmitButton>
          </>
        ) : (
          <p className="text-sm text-muted">{t.landingPages.noProducts}</p>
        )}
      </form>
    </Card>
  );
}

export function NewLanding({ lang, products, editorBase, createAction, t }: { lang: string; products: Product[]; editorBase: string; createAction: (s: ActionState, f: FormData) => Promise<ActionState>; t: NewLandingText }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <AiWizard lang={lang} products={products} editorBase={editorBase} t={t} />
      <div>
        <ManualForm lang={lang} products={products} action={createAction} t={t} />
      </div>
    </div>
  );
}
