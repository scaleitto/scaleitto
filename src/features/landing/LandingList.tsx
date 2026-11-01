"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ImageOff, LayoutGrid, List, PenLine, Plus, Sparkles, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Badge, Button, Card, Field, Select, buttonClass } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { createLandingPage } from "./actions";
import { PageActions } from "./PageActions";
import { useModal } from "@/ui/useModal";

type Text = Pick<Dictionary, "landingPages" | "errors" | "common">;
export type ListPage = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  productId: string;
  productName: string | null;
  image: string | null;
  views: number;
  orders: number;
  conversion: number | null;
  images: number;
  formBottom: boolean;
  updated: string;
  updatedAt: number;
  viewHref: string | null;
};

// The chosen view (list / grid) is remembered in this browser
const KEY = "sc_lp_view";
const listeners = new Set<() => void>();
function useView() {
  const view = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      try {
        return localStorage.getItem(KEY) === "grid" ? "grid" : "list";
      } catch {
        return "list";
      }
    },
    () => "list",
  );
  const set = (v: "list" | "grid") => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // private mode: the view just isn't remembered
    }
    listeners.forEach((cb) => cb());
  };
  return [view, set] as const;
}

// Landing pages (Zimam): filters (status, product, order), list or grid, and "create" with its two paths
export function LandingList({ lang, pages, products, defaultLanguage, base, t }: { lang: string; pages: ListPage[]; products: { id: string; name: string }[]; defaultLanguage: string; base: string; t: Text }) {
  const lp = t.landingPages;
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState("");
  const [sort, setSort] = useState<"recent" | "views" | "orders">("recent");
  const [view, setView] = useView();
  const dialog = useModal();
  const [mode, setMode] = useState<"pick" | "manual">("pick");
  const { state, pending, onSubmit } = useActionForm(createLandingPage.bind(null, lang));
  const errors = t.errors as Record<string, string>;
  const shown = useMemo(
    () =>
      pages
        .filter((p) => (!status || p.status === status) && (!product || p.productId === product))
        .sort((a, b) => (sort === "views" ? b.views - a.views : sort === "orders" ? b.orders - a.orders : b.updatedAt - a.updatedAt)),
    [pages, status, product, sort],
  );
  const text = { landingPages: lp, errors: t.errors, common: t.common };
  const stat = (n: number | string) => (n === 0 ? "—" : n);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label={lp.filters.allStatuses} data-filter="status">
          <option value="">{lp.filters.allStatuses}</option>
          <option value="published">{lp.statuses.published}</option>
          <option value="draft">{lp.statuses.draft}</option>
        </Select>
        <Select value={product} onChange={(e) => setProduct(e.target.value)} className="w-auto" aria-label={lp.filters.allProducts} data-filter="product">
          <option value="">{lp.filters.allProducts}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="w-auto" aria-label={lp.filters.sort.recent}>
          {(["recent", "views", "orders"] as const).map((k) => (
            <option key={k} value={k}>
              {lp.filters.sort[k]}
            </option>
          ))}
        </Select>
        <div className="ms-auto flex gap-1 rounded-lg border border-line bg-panel p-1">
          {(["list", "grid"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} aria-label={lp.filters[v]} title={lp.filters[v]} onClick={() => setView(v)} className={`rounded-md p-1.5 ${view === v ? "bg-panel-2 text-fg" : "text-muted"}`} data-view={v}>
              {v === "list" ? <List size={16} /> : <LayoutGrid size={16} />}
            </button>
          ))}
        </div>
        <Button
          type="button"
          onClick={() => {
            setMode("pick");
            dialog.current?.showModal();
          }}
          data-testid="create-landing"
        >
          <Plus size={16} /> {lp.createTitle}
        </Button>
      </div>
      <p className="text-xs text-muted" data-testid="showing">
        {fmt(lp.showing, { n: shown.length, total: pages.length })}
      </p>

      <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"} data-testid="landing-list" data-layout={view}>
        {shown.map((p) => (
          <Card key={p.id} className={`p-4 ${view === "grid" ? "space-y-3" : "flex flex-wrap items-center gap-4"}`} data-page={p.title}>
            <Link href={`${base}/${p.id}`} className={`flex min-w-0 items-center gap-3 ${view === "list" ? "flex-1" : ""}`}>
              <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-bg ${view === "grid" ? "size-16" : "size-12"}`}>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="size-full object-cover" />
                ) : (
                  <ImageOff size={18} className="text-muted" />
                )}
              </span>
              <span className="min-w-0 space-y-0.5">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{p.title}</span>
                  <Badge tone={p.status === "published" ? "accent" : "neutral"}>{lp.statuses[p.status]}</Badge>
                </span>
                <span className="block truncate text-xs text-muted">
                  {lp.product}: {p.productName ?? "—"}
                </span>
                <span className="block truncate text-xs text-muted" dir="ltr">
                  /lp/{p.slug}
                </span>
                <span className="block text-xs text-muted">
                  {fmt(lp.images, { n: p.images })} · {p.formBottom ? lp.formBottom : lp.formInside}
                </span>
              </span>
            </Link>
            <dl className="grid grid-cols-3 gap-4 text-center text-xs">
              {[
                [lp.columns.views, stat(p.views)],
                [lp.columns.orders, stat(p.orders)],
                [lp.orderRate, p.conversion == null ? "—" : `${p.conversion}%`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-semibold tracking-wide text-muted uppercase">{label}</dt>
                  <dd className="mt-0.5 text-base font-bold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-center gap-2">
              <Link href={`${base}/${p.id}`} className={buttonClass("secondary", "py-1.5")} data-testid="edit-landing">
                <PenLine size={14} /> {lp.edit}
              </Link>
              <PageActions lang={lang} id={p.id} editHref={`${base}/${p.id}`} viewHref={p.viewHref} t={text} />
            </div>
            <p className={`text-xs text-muted ${view === "list" ? "w-full sm:w-auto" : ""}`}>{fmt(lp.updated, { at: p.updated })}</p>
          </Card>
        ))}
      </div>

      <dialog ref={dialog} className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="create-dialog">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-bold">{lp.createTitle}</h2>
          <button type="button" aria-label={lp.close} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => dialog.current?.close()}>
            <X size={18} />
          </button>
        </div>
        {mode === "pick" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <button type="button" onClick={() => setMode("manual")} className="space-y-2 rounded-xl border border-line p-4 text-start hover:border-accent/50 hover:bg-accent-soft" data-create="manual">
              <PenLine size={20} className="text-accent" />
              <p className="font-semibold">{lp.createManual}</p>
              <p className="text-xs text-muted">{lp.createManualHint}</p>
            </button>
            <Link href={`${base}/new`} className="space-y-2 rounded-xl border border-line p-4 hover:border-accent/50 hover:bg-accent-soft" data-create="ai">
              <Sparkles size={20} className="text-accent" />
              <p className="font-semibold">{lp.createAi}</p>
              <p className="text-xs text-muted">{lp.createAiHint}</p>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 p-4" noValidate>
            <input type="hidden" name="pageStyle" value="blank" />
            <input type="hidden" name="language" value={defaultLanguage} />
            {products.length === 0 ? (
              <p className="text-sm text-muted">{lp.noProducts}</p>
            ) : (
              <Field label={lp.product} htmlFor="create-product" error={fieldError(state, errors, "productId")}>
                <Select id="create-product" name="productId" defaultValue="">
                  <option value="">{lp.chooseProduct}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <FormMessage state={state} errors={errors} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode("pick")}>
                {t.common.back}
              </Button>
              <SubmitButton pending={pending} disabled={products.length === 0} data-testid="create-manual">
                {lp.createGo}
              </SubmitButton>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
