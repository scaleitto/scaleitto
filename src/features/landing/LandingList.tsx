"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { ChartColumn, Copy, ExternalLink, Eye, EyeOff, ImageOff, LayoutGrid, List, MoreHorizontal, PenLine, Search, Share2, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import type { ActionState } from "@/lib/action";
import { Badge, Card, Input, Select, buttonClass } from "@/ui";
import { deleteLandingPage, duplicateLandingPage, pageVersionStats, setLandingLive } from "./actions";
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
  url: string;
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

const iconButton = "grid size-9 place-items-center rounded-full bg-panel-2 text-muted transition hover:bg-accent-soft hover:text-accent-ink disabled:opacity-50";

// One page's actions (Zimam): copy the link, open it, the versions' numbers, publish / unpublish, more (duplicate,
// delete), and Edit
function RowActions({ lang, page, editHref, t }: { lang: string; page: ListPage; editHref: string; t: Text }) {
  const lp = t.landingPages;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof pageVersionStats>> | undefined>(undefined);
  const statsDialog = useModal();
  const live = page.status === "published";
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      const e = t.errors as Record<string, string>;
      setError(r.ok ? null : (e[r.error ?? "unexpected"] ?? e.unexpected));
    });
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          className={iconButton}
          title={copied ? lp.actions.copied : lp.actions.share}
          aria-label={lp.actions.share}
          onClick={() => {
            void navigator.clipboard?.writeText(page.url);
            setCopied(true);
          }}
          data-action="share"
        >
          <Share2 size={16} />
        </button>
        {live && (
          <a href={page.url} target="_blank" rel="noreferrer" className={iconButton} title={lp.actions.open} aria-label={lp.actions.open} data-action="open">
            <ExternalLink size={16} />
          </a>
        )}
        <button
          type="button"
          className={iconButton}
          title={lp.actions.stats}
          aria-label={lp.actions.stats}
          data-action="stats"
          onClick={() => {
            setStats(undefined);
            statsDialog.current?.showModal();
            start(async () => setStats(await pageVersionStats(lang, page.id)));
          }}
        >
          <ChartColumn size={16} />
        </button>
        <button type="button" className={iconButton} disabled={pending} title={live ? lp.actions.unpublish : lp.actions.publish} aria-label={live ? lp.actions.unpublish : lp.actions.publish} onClick={() => run(() => setLandingLive(lang, page.id, !live))} data-action="toggle-live">
          {live ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <details className="group relative">
          <summary className={`${iconButton} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label={lp.actions.more} data-action="more">
            <MoreHorizontal size={16} />
          </summary>
          <div className="absolute end-0 top-11 z-20 w-44 rounded-xl border border-line bg-panel p-1 shadow-lift">
            <button type="button" disabled={pending} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-panel-2" onClick={() => run(() => duplicateLandingPage(lang, page.id))} data-action="duplicate">
              <Copy size={15} className="text-muted" /> {lp.actions.duplicate}
            </button>
            <button
              type="button"
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft"
              onClick={() => {
                if (confirm(lp.confirmDelete)) run(() => deleteLandingPage(lang, page.id));
              }}
              data-action="delete"
            >
              <Trash2 size={15} /> {lp.actions.delete}
            </button>
          </div>
        </details>
        <Link href={editHref} className={buttonClass("secondary", "ms-2 py-1.5")} data-testid="edit-landing">
          <PenLine size={14} /> {lp.edit}
        </Link>
      </div>
      <p className="text-xs text-muted">{fmt(lp.updated, { at: page.updated })}</p>
      {error && <p className="max-w-xs text-xs text-danger">{error}</p>}
      <dialog ref={statsDialog} className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="version-stats">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-bold">{lp.versionStats.title}</h2>
          <button type="button" aria-label={lp.close} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => statsDialog.current?.close()}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          {stats === undefined ? (
            <p className="text-sm text-muted">{t.common.loading}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1.5 text-start" />
                  <th className="py-1.5 text-end">{lp.versionStats.views}</th>
                  <th className="py-1.5 text-end">{lp.versionStats.orders}</th>
                  <th className="py-1.5 text-end">{lp.versionStats.rate}</th>
                </tr>
              </thead>
              <tbody>
                {(stats ?? []).map((v) => (
                  <tr key={v.key} className="border-t border-line" data-version={v.key}>
                    <td className="py-2 font-semibold">
                      {fmt(lp.versionStats.version, { k: v.key })} {v.paused && <span className="text-xs font-normal text-muted">({lp.versionStats.paused})</span>}
                    </td>
                    <td className="py-2 text-end tabular-nums">{v.views}</td>
                    <td className="py-2 text-end tabular-nums">{v.orders}</td>
                    <td className="py-2 text-end tabular-nums">{v.rate == null ? "—" : `${v.rate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </dialog>
    </div>
  );
}

// Landing pages (Zimam): search, filters (status, product, order), list or grid (the create paths are in CreateLanding)
export function LandingList({ lang, pages, products, base, t }: { lang: string; pages: ListPage[]; products: { id: string; name: string }[]; base: string; t: Text }) {
  const lp = t.landingPages;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState("");
  const [sort, setSort] = useState<"recent" | "views" | "orders">("recent");
  const [view, setView] = useView();
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pages
      .filter((p) => (!status || p.status === status) && (!product || p.productId === product) && (!needle || [p.title, p.productName ?? "", p.slug].some((x) => x.toLowerCase().includes(needle))))
      .sort((a, b) => (sort === "views" ? b.views - a.views : sort === "orders" ? b.orders - a.orders : b.updatedAt - a.updatedAt));
  }, [pages, q, status, product, sort]);
  const stat = (n: number) => (n === 0 ? "—" : n);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1 sm:max-w-72">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lp.search} aria-label={lp.search} className="ps-9" data-filter="search" />
        </label>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto!" aria-label={lp.filters.allStatuses} data-filter="status">
          <option value="">{lp.filters.allStatuses}</option>
          <option value="published">{lp.statuses.published}</option>
          <option value="draft">{lp.statuses.draft}</option>
        </Select>
        <Select value={product} onChange={(e) => setProduct(e.target.value)} className="w-auto!" aria-label={lp.filters.allProducts} data-filter="product">
          <option value="">{lp.filters.allProducts}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="w-auto!" aria-label={lp.filters.sort.recent}>
          {(["recent", "views", "orders"] as const).map((k) => (
            <option key={k} value={k}>
              {lp.filters.sort[k]}
            </option>
          ))}
        </Select>
        <div className="flex gap-1 rounded-lg border border-line bg-panel p-1">
          {(["list", "grid"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} aria-label={lp.filters[v]} title={lp.filters[v]} onClick={() => setView(v)} className={`rounded-md p-1.5 ${view === v ? "bg-accent text-accent-fg" : "text-muted"}`} data-view={v}>
              {v === "list" ? <List size={16} /> : <LayoutGrid size={16} />}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted" data-testid="showing">
        {fmt(lp.showing, { n: shown.length, total: pages.length })}
      </p>

      {pages.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="font-semibold">{lp.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted">{lp.emptyBody}</p>
        </Card>
      ) : (
        <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"} data-testid="landing-list" data-layout={view}>
          {shown.map((p) => (
            <Card key={p.id} className={`p-4 ${view === "grid" ? "space-y-3" : "flex flex-wrap items-center gap-4"}`} data-page={p.title} data-status={p.status}>
              <div className={`flex min-w-0 items-center gap-3 ${view === "list" ? "flex-1" : ""}`}>
                <Link href={`${base}/${p.id}`} className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-bg">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageOff size={18} className="text-muted" />
                  )}
                </Link>
                <div className="min-w-0 space-y-0.5">
                  <p className="flex items-center gap-2">
                    <Link href={`${base}/${p.id}`} className="truncate font-bold hover:underline">
                      {p.title}
                    </Link>
                    <Badge tone={p.status === "published" ? "accent" : "neutral"}>{lp.statuses[p.status]}</Badge>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {lp.product}: {p.productName ?? "—"}
                  </p>
                  <p className="truncate font-mono text-xs text-muted" dir="ltr">
                    /lp/{p.slug}
                  </p>
                  <p className="text-xs text-muted">
                    {fmt(lp.images, { n: p.images })} · {p.formBottom ? lp.formBottom : lp.formInside}
                  </p>
                </div>
              </div>
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
              <RowActions lang={lang} page={p} editHref={`${base}/${p.id}`} t={t} />
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}
