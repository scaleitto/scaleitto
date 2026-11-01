"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ImageOff, LoaderCircle, Search, Sparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import { Alert, Button, Card, Input, Textarea } from "@/ui";
import { checkAiLanding, startAiLanding } from "./ai-actions";
import { frameworkCodes, frameworks, posterSizes, sizeNames, styleFamilies, type Framework, type StyleFamily } from "./ai-options";
import { pageLanguages, type PageLanguage } from "./types";

type Text = Pick<Dictionary, "landingPages" | "errors" | "common">;
type Product = { id: string; name: string; price: number; image: string | null };

const POLL_MS = 3000;
const GIVE_UP_MS = 12 * 60_000;
const tile = (on: boolean) => `relative rounded-xl border p-3 text-start transition ${on ? "border-accent bg-accent-soft ring-1 ring-accent/40" : "border-line bg-panel hover:border-accent/40"}`;

// "Generate with AI" (Zimam): the product, the language of the texts in the images, the brief and the writing
// framework on one side; the size, the style family, the price text and the cost on the other; then the progress
// until the page opens in the builder.
export function AiBuilder({ lang, products, defaultLanguage, aiLeft, backHref, editorBase, t }: { lang: string; products: Product[]; defaultLanguage: PageLanguage; aiLeft: number | null; backHref: string; editorBase: string; t: Text }) {
  const ai = t.landingPages.ai;
  const router = useRouter();
  const errors = t.errors as Record<string, string>;
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [language, setLanguage] = useState<PageLanguage>(defaultLanguage);
  const [brief, setBrief] = useState("");
  const [framework, setFramework] = useState<Framework>("auto");
  const [size, setSize] = useState<(typeof posterSizes)[number]>(2);
  const [style, setStyle] = useState<StyleFamily>("auto");
  const [priceText, setPriceText] = useState("");
  const [phase, setPhase] = useState<"form" | "working" | "failed">("form");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: number; done?: number; total?: number }>({ step: 0 });
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(0);
  const uses = 1 + size;
  const enough = aiLeft === null || aiLeft >= uses;
  const shown = products.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    if (phase !== "working") return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  async function generate() {
    setPhase("working");
    setError(null);
    setProgress({ step: 0 });
    started.current = Date.now();
    setElapsed(0);
    const fail = (key: string, detail?: string) => {
      setPhase("failed");
      setError(`${errors[key] ?? errors.unexpected}${detail ? `: ${detail}` : ""}`);
    };
    const r = await startAiLanding(lang, { productId, language, brief, framework, size, style, priceText }).catch(() => ({ ok: false as const, error: "unexpected" }));
    if (!r.ok) return fail(r.error, "message" in r ? r.message : undefined);
    setProgress({ step: 1 });
    while (Date.now() - started.current < GIVE_UP_MS) {
      await new Promise((res) => setTimeout(res, POLL_MS));
      const c = await checkAiLanding(lang, r.generationId).catch(() => ({ state: "pending" as const }));
      if (c.state === "done") {
        router.push(`${editorBase}/${c.pageId}`);
        return;
      }
      if (c.state === "failed") return fail(c.error, c.message);
      if ("step" in c && c.step === "images") setProgress({ step: 2, done: c.done, total: c.total });
    }
    fail("aiFailed");
  }

  if (phase !== "form") {
    return (
      <Card className="mx-auto max-w-xl space-y-5 py-8 text-center" data-testid="ai-progress">
        {phase === "working" ? (
          <>
            <LoaderCircle size={40} className="mx-auto animate-spin text-accent" />
            <div>
              <p className="text-lg font-bold">{ai.working}</p>
              <p className="text-sm text-muted">{ai.workingHint}</p>
            </div>
            <ol className="mx-auto max-w-sm space-y-2 text-start text-sm">
              {ai.steps.map((s, i) => (
                <li key={s} className={`flex items-center gap-2 ${i <= progress.step ? "font-semibold" : "text-muted"}`}>
                  {i < progress.step ? <Check size={16} className="text-accent" /> : i === progress.step ? <LoaderCircle size={16} className="animate-spin text-accent" /> : <span className="size-4" />}
                  {i === 2 && progress.total ? fmt(ai.designing, { done: progress.done ?? 0, total: progress.total }) : s}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted tabular-nums">{fmt(ai.elapsed, { s: elapsed })}</p>
            {elapsed > 180 && <p className="text-xs text-warning">{ai.slow}</p>}
          </>
        ) : (
          <>
            <Alert>{error ?? ai.failed}</Alert>
            <div className="flex justify-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setPhase("form")}>
                {t.common.back}
              </Button>
              <Button type="button" onClick={generate}>
                {ai.retry}
              </Button>
            </div>
          </>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="ai-builder">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowRight size={15} className="ltr:rotate-180" /> {ai.back}
      </Link>
      <Card className="space-y-3 p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-fg">
          <Sparkles size={22} />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">{ai.title}</h1>
        <p className="max-w-2xl text-muted">{ai.subtitle}</p>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card className="space-y-5">
          <div>
            <h2 className="font-bold">{ai.product}</h2>
            <p className="text-sm text-muted">{ai.productHint}</p>
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-muted">{ai.noProducts}</p>
          ) : (
            <>
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ai.search} aria-label={ai.search} className="ps-9" />
              </label>
              <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2" role="radiogroup" aria-label={ai.product}>
                {shown.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={productId === p.id} onClick={() => setProductId(p.id)} className={`${tile(productId === p.id)} flex items-center gap-3`} data-product={p.name}>
                    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel-2">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="size-full object-cover" />
                      ) : (
                        <ImageOff size={18} className="text-muted" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="text-sm font-semibold text-accent">{formatPrice(p.price, lang === "ar" ? "د.ج" : "DA")}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          <hr className="border-line" />
          <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
            <div className="space-y-2" role="radiogroup" aria-label={ai.language}>
              <p className="text-sm font-semibold">{ai.language}</p>
              {pageLanguages.map((l) => (
                <button key={l} type="button" role="radio" aria-checked={language === l} onClick={() => setLanguage(l)} className={`${tile(language === l)} flex w-full items-center justify-between py-2.5 text-sm font-semibold`} data-language={l}>
                  {t.landingPages.languages[l]} {language === l && <Check size={15} className="text-accent" />}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ai-brief" className="text-sm font-semibold">
                {ai.brief}
              </label>
              <Textarea id="ai-brief" rows={6} maxLength={900} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={ai.briefPlaceholder} />
              <p className="text-end text-xs text-muted tabular-nums">{brief.length}/900</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{ai.framework}</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={ai.framework}>
              {frameworks.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={framework === f} onClick={() => setFramework(f)} className={tile(framework === f)} data-framework={f}>
                  <span className="flex items-center justify-between gap-2 font-semibold">
                    {ai.frameworks[f][0]} {framework === f && <Check size={15} className="text-accent" />}
                  </span>
                  {frameworkCodes[f] && <span className="block text-[11px] font-bold tracking-wide text-muted">{frameworkCodes[f]}</span>}
                  <span className="mt-1 block text-xs text-muted">{ai.frameworks[f][1]}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <h2 className="font-bold">{ai.briefTitle}</h2>
            <p className="text-sm text-muted">{ai.briefHint}</p>
          </div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={ai.briefTitle}>
            {posterSizes.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => setSize(n)} className={tile(size === n)} data-size={n}>
                <span className="flex items-center justify-between font-semibold">
                  {ai.sizes[sizeNames[n]]} {size === n && <Check size={15} className="text-accent" />}
                </span>
                <span className="text-xs text-muted">{fmt(ai.imagesN, { n })}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{ai.style}</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={ai.style}>
              {styleFamilies.map((s) => (
                <button key={s.key} type="button" role="radio" aria-checked={style === s.key} onClick={() => setStyle(s.key)} className={tile(style === s.key)} data-style={s.key}>
                  <span className="mb-2 flex h-1.5 overflow-hidden rounded-full" aria-hidden>
                    {s.colors.map((c, i) => (
                      <span key={i} className="flex-1" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="flex items-center justify-between font-semibold">
                    {ai.styles[s.key][0]} {style === s.key && <Check size={15} className="text-accent" />}
                  </span>
                  <span className="text-xs text-muted">{ai.styles[s.key][1]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ai-price" className="text-sm font-semibold">
              {ai.priceText}
            </label>
            <Input id="ai-price" maxLength={60} value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder={ai.priceTextPlaceholder} />
          </div>
          <div className="rounded-xl border border-line bg-panel-2 p-3 text-sm" data-testid="ai-cost">
            <span className="font-semibold">{ai.cost}</span> · {fmt(ai.costLine, { n: size, uses })}
            <span className="block text-xs text-muted">{fmt(ai.left, { n: aiLeft === null ? ai.unlimited : aiLeft })}</span>
          </div>
          {!enough && <Alert>{ai.notEnough}</Alert>}
          <p className="text-xs text-muted">{ai.honesty}</p>
          <Button type="button" className="w-full py-3 text-base" disabled={!productId || !enough} onClick={generate} data-testid="ai-generate">
            <Sparkles size={18} /> {ai.generate}
          </Button>
        </Card>
      </div>
    </div>
  );
}
