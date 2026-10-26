"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { ImageManager } from "@/components/dashboard/ImageManager";
import type { AiJobStatus, AiStartState } from "../actions";

const languages = ["ar", "dz", "fr", "en"] as const;
const tones = ["persuasive", "premium", "friendly", "urgent"] as const;
const sources = ["product", "images", "link"] as const;
const stages = ["starting", "importing", "images", "writing", "saving"] as const;
type Source = (typeof sources)[number];

const icons: Record<Source, string> = { product: "📦", images: "📷", link: "🔗" };

export function AiForm({
  t,
  lang,
  action,
  checkStatus,
  products,
  defaultLanguage,
}: {
  t: Dictionary;
  lang: string;
  action: (state: AiStartState, formData: FormData) => Promise<AiStartState>;
  checkStatus: (jobId: string) => Promise<AiJobStatus>;
  products: { id: string; name: string; image: string | null }[];
  defaultLanguage: string;
}) {
  const a = t.ai;
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, {});
  const [source, setSource] = useState<Source>(products.length ? "product" : "images");
  const [images, setImages] = useState<string[]>([]);
  const [job, setJob] = useState<AiJobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // A new job id from the server starts the progress screen.
  if (state.jobId && state.jobId !== jobId) {
    setJobId(state.jobId);
    setJob({ status: "queued", stage: "starting" });
    setElapsed(0);
  }

  // Poll the background job until it finishes, then open the editor.
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    const poll = async () => {
      if (stopped) return;
      try {
        const status = await checkStatus(jobId);
        if (stopped) return;
        setJob(status);
        if (status.status === "done" && status.landingPageId) {
          router.push(`/${lang}/dashboard/landing-pages/${status.landingPageId}?generated=1`);
          return;
        }
        if (status.status === "failed") return;
      } catch {
        // network hiccup: keep polling
      }
      setTimeout(poll, 2500);
    };
    const first = setTimeout(poll, 1500);
    return () => {
      stopped = true;
      clearInterval(tick);
      clearTimeout(first);
    };
  }, [jobId, checkStatus, lang, router]);

  if (jobId && job && job.status !== "failed") {
    const visible = stages.filter((s) => source === "link" || (s !== "importing" && s !== "images"));
    const current = Math.max(0, visible.indexOf((job.stage ?? "starting") as (typeof stages)[number]));
    return (
      <div className="card space-y-6 text-center">
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
        <div>
          <h2 className="text-xl font-bold">{a.progressTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{a.progressHint}</p>
        </div>
        <ol className="mx-auto max-w-sm space-y-2 text-start">
          {visible.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${i === current ? "bg-brand/10 font-semibold" : ""}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${i < current ? "bg-green-500 text-white" : i === current ? "bg-brand text-white" : "bg-slate-200"}`}>
                {i < current ? "✓" : i + 1}
              </span>
              {a.stages[s]}
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-400">{elapsed} {a.seconds}</p>
      </div>
    );
  }

  const errorText =
    state.error === "limit" ? a.limitReached
    : state.error === "pageLimit" ? t.landingPages.limitReached
    : state.error === "productLimit" ? a.productLimit
    : state.error === "notConfigured" ? a.notConfigured
    : state.error === "price" ? a.priceRequired
    : state.error === "noImages" ? a.imagesRequired
    : state.error ? t.auth.errors.validation
    : null;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      {job?.status === "failed" && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <b>{a.failed}</b>
          {job.error && <span className="mt-1 block font-mono text-xs" dir="ltr">{job.error}</span>}
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="font-bold">{a.source}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {sources.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              disabled={s === "product" && products.length === 0}
              className={`rounded-xl border-2 p-4 text-start transition disabled:opacity-40 ${source === s ? "border-brand bg-brand/5" : "border-slate-200 hover:border-slate-300"}`}
            >
              <div className="text-2xl">{icons[s]}</div>
              <div className="mt-2 font-semibold">{a.sources[s].title}</div>
              <div className="mt-1 text-xs text-slate-500">{a.sources[s].body}</div>
            </button>
          ))}
        </div>

        {source === "product" && (
          <div>
            <label className="label" htmlFor="productId">{a.product}</label>
            <select className="input" id="productId" name="productId" required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        {source === "link" && (
          <div>
            <label className="label" htmlFor="link">{a.link}</label>
            <input className="input font-mono text-sm" id="link" name="link" type="url" required dir="ltr" placeholder="https://…/products/…" />
            <p className="mt-1 text-xs text-slate-500">{a.linkHint}</p>
          </div>
        )}
        {source === "images" && <p className="text-sm text-slate-600">{a.imagesHint}</p>}
        {(source === "images" || source === "link") && (
          <>
            <ImageManager t={t} value={images} onChange={setImages} max={6} />
            <p className="text-xs text-amber-700">{a.rightsNote}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="price">{a.sellingPrice}</label>
                <input className="input" id="price" name="price" type="number" min={1} required />
              </div>
              <div>
                <label className="label" htmlFor="compareAtPrice">{a.compareAtPrice}</label>
                <input className="input" id="compareAtPrice" name="compareAtPrice" type="number" min={0} />
              </div>
            </div>
            <p className="text-xs text-slate-500">{a.newProductNote}</p>
          </>
        )}
      </div>

      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="language">{a.language}</label>
            <select className="input" id="language" name="language" defaultValue={defaultLanguage}>
              {languages.map((l) => (
                <option key={l} value={l}>{a.languages[l]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tone">{a.tone}</label>
            <select className="input" id="tone" name="tone" defaultValue="persuasive">
              {tones.map((tone) => (
                <option key={tone} value={tone}>{a.tones[tone]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="audience">{a.audience}</label>
          <input className="input" id="audience" name="audience" maxLength={300} placeholder={a.audiencePlaceholder} />
        </div>
        <div>
          <label className="label" htmlFor="notes">{a.notes}</label>
          <textarea className="input min-h-28" id="notes" name="notes" maxLength={4000} placeholder={a.notesPlaceholder} />
        </div>
      </div>

      {errorText && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorText}</p>}

      <button className="btn w-full bg-linear-to-l from-fuchsia-600 to-indigo-600 py-3 text-base" disabled={pending}>
        {pending ? t.common.loading : job?.status === "failed" ? a.retry : a.generate}
      </button>
    </form>
  );
}
