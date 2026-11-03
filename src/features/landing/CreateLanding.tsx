"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ImageOff, LayoutTemplate, PackagePlus, Plus, Search, Sparkles, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatPrice } from "@/lib/format";
import { Button, Field, Input } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { useModal } from "@/ui/useModal";
import { createLandingPage } from "./actions";

type Text = Pick<Dictionary, "landingPages" | "errors" | "common" | "media">;
export type ProductChoice = { id: string; name: string; price: number; image: string | null; draft: boolean };

// Landing pages header (Zimam): title + "Create landing page" (→ "Close") opening the two paths inline — design manually
// (choose an existing product or create a new one, then the empty builder) and generate with AI (its own page)
export function CreateLanding({ lang, base, products, title, description, t }: { lang: string; base: string; products: ProductChoice[]; title: string; description: string; t: Text }) {
  const lp = t.landingPages;
  const errors = t.errors as Record<string, string>;
  const [open, setOpen] = useState(false);
  const dialog = useModal();
  const [tab, setTab] = useState<"existing" | "new">(products.length ? "existing" : "new");
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const { state, pending, onSubmit } = useActionForm(createLandingPage.bind(null, lang));
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? products.filter((p) => p.name.toLowerCase().includes(needle)) : products;
  }, [products, q]);
  return (
    <div className="mb-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LayoutTemplate size={22} className="text-accent" /> {title}
          </h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <Button type="button" className="h-11 px-5" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="create-landing">
          {open ? <X size={16} /> : <Plus size={16} />} {open ? lp.close : lp.createTitle}
        </Button>
      </div>
      {open && (
        <div className="grid gap-4 rounded-2xl border border-line bg-panel p-4 md:grid-cols-2" data-testid="create-paths">
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="space-y-3 rounded-2xl border-2 border-accent/40 bg-accent-soft/40 p-6 text-start transition-colors hover:border-accent"
            data-create="manual"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-accent text-white">
              <LayoutTemplate size={20} />
            </span>
            <p className="text-lg font-bold">{lp.createManual}</p>
            <p className="text-sm text-fg-2">{lp.createManualHint}</p>
          </button>
          <Link href={`${base}/new`} className="space-y-3 rounded-2xl bg-slate-950 p-6 text-white transition-opacity hover:opacity-95" data-create="ai">
            <span className="grid size-11 place-items-center rounded-xl bg-white text-slate-950">
              <Sparkles size={20} />
            </span>
            <p className="text-lg font-bold">{lp.createAi}</p>
            <p className="text-sm text-white/75">{lp.createAiHint}</p>
          </Link>
        </div>
      )}

      <dialog ref={dialog} className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="create-dialog">
        <form onSubmit={onSubmit} noValidate>
          <input type="hidden" name="mode" value={tab} />
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold">{lp.pickTitle}</h2>
            <button type="button" aria-label={lp.close} className="grid size-8 place-items-center rounded-full bg-panel-2 text-fg-2 hover:bg-line" onClick={() => dialog.current?.close()}>
              <X size={16} />
            </button>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-panel-2 p-1" role="tablist">
              {(["existing", "new"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? "bg-panel shadow-sm" : "text-muted"}`} data-pick-tab={k}>
                  {k === "existing" ? <LayoutTemplate size={15} /> : <PackagePlus size={15} />} {lp.pickTabs[k]}
                </button>
              ))}
            </div>
            <FormMessage state={state} errors={errors} />
            {tab === "existing" ? (
              products.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{lp.noProducts}</p>
              ) : (
                <>
                  <label className="relative block">
                    <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lp.pickSearch} aria-label={lp.pickSearch} className="ps-9" />
                  </label>
                  {fieldError(state, errors, "productId") && <p className="text-xs text-danger">{fieldError(state, errors, "productId")}</p>}
                  <input type="hidden" name="productId" value={picked ?? ""} />
                  <ul className="max-h-80 space-y-2 overflow-y-auto" data-testid="pick-products">
                    {shown.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(p.id)}
                          aria-pressed={picked === p.id}
                          className={`flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-start transition-colors ${picked === p.id ? "border-accent bg-accent-soft/40" : "border-line hover:border-fg-2/30"}`}
                          data-pick-product={p.id}
                        >
                          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-bg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.image ? <img src={p.image} alt="" className="size-full object-cover" /> : <ImageOff size={16} className="text-muted" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{p.name}</span>
                            <span className="text-xs text-muted">
                              {formatPrice(p.price, t.common.currency)}
                              {p.draft && ` · ${lp.draftProduct}`}
                            </span>
                          </span>
                          {picked === p.id && (
                            <span className="grid size-6 place-items-center rounded-full bg-accent text-white">
                              <Check size={14} />
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )
            ) : (
              <div className="space-y-4" data-testid="new-product">
                <p className="text-sm text-muted">{lp.newProductHint}</p>
                <Field label={`${lp.newName} *`} htmlFor="lp-new-name" error={fieldError(state, errors, "name")}>
                  <Input id="lp-new-name" name="name" maxLength={200} />
                </Field>
                <Field label={`${lp.newPrice} *`} htmlFor="lp-new-price" error={fieldError(state, errors, "price")}>
                  <Input id="lp-new-price" name="price" inputMode="numeric" dir="ltr" />
                </Field>
                <Field label={lp.newImage}>
                  <ImageManager t={t.media} value={images} onChange={setImages} max={1} />
                </Field>
                <input type="hidden" name="image" value={images[0] ?? ""} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-line px-5 py-4">
            <Button type="button" variant="secondary" className="h-11" onClick={() => dialog.current?.close()}>
              {t.common.cancel}
            </Button>
            <SubmitButton pending={pending} className="col-span-2 h-11" disabled={tab === "existing" && !picked} data-testid="create-manual">
              {tab === "existing" ? lp.createGo : lp.createWithProduct}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </div>
  );
}
