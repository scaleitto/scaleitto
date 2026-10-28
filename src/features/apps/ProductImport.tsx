"use client";

import { useRef, useState } from "react";
import { Download, ImageOff, PackageSearch } from "lucide-react";
import { fmt, formatPrice } from "@/lib/format";
import { Alert, Badge, Button, Card, Field, Input } from "@/ui";
import { fetchCatalog, importCatalogProduct } from "./actions";
import type { CatalogProduct } from "./catalog";
import type { AppsText } from "./AppCards";

type Source = "shopify" | "youcan";

export function ProductImport({ lang, t }: { lang: string; t: AppsText }) {
  const im = t.apps.import;
  const e = t.errors as Record<string, string>;
  const [source, setSource] = useState<Source>("shopify");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number; created: number; exists: number; failed: number; running: boolean } | null>(null);
  const stop = useRef(false);

  async function load() {
    setLoading(true);
    setError(null);
    setProducts(null);
    setProgress(null);
    const r = await fetchCatalog(lang, source, input).catch(() => ({ ok: false as const, error: "unexpected" }));
    setLoading(false);
    if (!r.ok) {
      setError(`${e[r.error] ?? e.unexpected}${"message" in r && r.message ? `: ${r.message}` : ""}`);
      return;
    }
    setProducts(r.products);
    setExisting(new Set(r.existing));
    setSelected(new Set(r.products.filter((p) => !r.existing.includes(p.ref)).map((p) => p.ref)));
  }

  // One request per product, so a long import never hits the hosting's time limit
  async function run() {
    const list = (products ?? []).filter((p) => selected.has(p.ref));
    stop.current = false;
    const state = { done: 0, total: list.length, created: 0, exists: 0, failed: 0, running: true };
    setProgress({ ...state });
    for (const p of list) {
      if (stop.current) break;
      const r = await importCatalogProduct(lang, p).catch(() => ({ ok: false, error: "unexpected", message: undefined }));
      state.done++;
      if (r.ok && r.message === "created") state.created++;
      else if (r.ok) state.exists++;
      else {
        state.failed++;
        if (r.error === "limitProducts") {
          setError(e.limitProducts);
          break;
        }
      }
      if (r.ok) setExisting((s) => new Set(s).add(p.ref));
      setProgress({ ...state });
    }
    setProgress({ ...state, running: false });
    setSelected(new Set());
  }

  const toggle = (ref: string) => setSelected((s) => (s.has(ref) ? new Set([...s].filter((x) => x !== ref)) : new Set(s).add(ref)));
  const importable = (products ?? []).filter((p) => !existing.has(p.ref));

  return (
    <Card className="space-y-4" data-testid="product-import">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <PackageSearch size={20} />
        </span>
        <div>
          <h2 className="font-semibold">{im.title}</h2>
          <p className="mt-0.5 text-sm text-muted">{im.description}</p>
        </div>
      </div>
      <nav className="flex w-fit gap-1 rounded-lg bg-panel-2 p-1 text-sm">
        {(["shopify", "youcan"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={source === s}
            onClick={() => {
              setSource(s);
              setInput("");
              setProducts(null);
              setError(null);
            }}
            className={`rounded-md px-4 py-1.5 font-medium ${source === s ? "bg-panel text-fg" : "text-muted hover:text-fg"}`}
          >
            {im[s]}
          </button>
        ))}
      </nav>
      {source === "youcan" && <Alert variant="info">{im.youcanBeta}</Alert>}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          load();
        }}
      >
        <div className="min-w-60 flex-1">
          <Field label={source === "shopify" ? im.shopifyLabel : im.youcanLabel} htmlFor="import-input" hint={source === "shopify" ? im.shopifyHint : im.youcanHint}>
            <Input id="import-input" dir="ltr" type={source === "youcan" ? "password" : "text"} autoComplete="off" value={input} onChange={(ev) => setInput(ev.target.value)} placeholder={source === "shopify" ? "mystore.com" : ""} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={loading || progress?.running} className="mb-6">
          {loading ? im.fetching : im.fetch}
        </Button>
      </form>
      {error && <Alert>{error}</Alert>}

      {products && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold">{fmt(im.found, { n: products.length })}</p>
            {importable.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={importable.every((p) => selected.has(p.ref))}
                  onChange={(ev) => setSelected(ev.target.checked ? new Set(importable.map((p) => p.ref)) : new Set())}
                  className="size-4 accent-[var(--color-accent)]"
                />
                {im.selectAll}
              </label>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto rounded-lg border border-line" data-testid="catalog">
            {products.map((p) => {
              const done = existing.has(p.ref);
              return (
                <li key={p.ref} data-ref={p.ref}>
                  <label className={`flex items-center gap-3 p-2.5 text-sm ${done ? "opacity-60" : "cursor-pointer hover:bg-panel-2"}`}>
                    <input type="checkbox" disabled={done || progress?.running} checked={selected.has(p.ref)} onChange={() => toggle(p.ref)} className="size-4 accent-[var(--color-accent)]" aria-label={p.name} />
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-bg">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageOff size={14} className="text-muted" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">
                        {formatPrice(p.price, "")}
                        {p.variants.length > 0 && ` · ${fmt(im.variants, { n: p.variants.length })}`}
                      </span>
                    </span>
                    {done && <Badge tone="accent">{im.already}</Badge>}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-warning">{im.draftNote}</p>
          {progress && (
            <div className="space-y-1.5" data-testid="import-progress">
              <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full bg-accent transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <p className="text-sm" data-testid="import-result">
                {progress.running ? fmt(im.importing, { done: progress.done, total: progress.total }) : fmt(im.result, { created: progress.created, exists: progress.exists, failed: progress.failed })}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button disabled={!selected.size || progress?.running} onClick={run}>
              <Download size={16} /> {fmt(im.importSelected, { n: selected.size })}
            </Button>
            {progress?.running && (
              <Button variant="secondary" onClick={() => (stop.current = true)}>
                {im.stop}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
