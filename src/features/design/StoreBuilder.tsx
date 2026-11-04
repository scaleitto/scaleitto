"use client";

// Zimam's Design page: a full-screen store builder. Top bar = back, published state, page picker, "Add custom page",
// page settings, desktop / mobile, undo / redo, discard draft, history, preview store, publish. Left = an icon rail
// (sections, colors & fonts, pages) and the sections panel with its Content | Layout tabs; middle = the real store
// with the draft. Sections are drafted and published; the header, announcement bar, navigation, footer and theme
// panel are global and apply at once. Everything saves as it goes.
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  History,
  LayoutGrid,
  LayoutPanelTop,
  Megaphone,
  Menu,
  Monitor,
  Palette,
  PanelBottom,
  PenLine,
  Plus,
  Redo2,
  Settings,
  Smartphone,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import { fmt, formatDate, formatTime } from "@/lib/format";
import { Alert, Button, Field, Input } from "@/ui";
import { useModal } from "@/ui/useModal";
import { AnnouncementBar, StoreFooter, StoreFrame, StoreHeader, type BadgeItem, type GridProduct } from "@/features/storefront/blocks";
import { StoreSections } from "@/features/storefront/sections";
import type { CollectionTexts } from "@/server/db/schema";
import { storeTheme } from "./types";
import { navHref, newId, newSection, pageHandle, samePages, storeSectionTypes, MAX_PAGES, MAX_SECTIONS, type StorePages, type StoreSection, type StoreSectionType } from "./builder";
import { discardStoreDraft, getDesignVersion, listDesignHistory, publishStoreDesign, saveStoreDesign } from "./actions";
import { GlobalFields, SectionFields, ThemeFields, type BuilderText, type GlobalState, type Targets } from "./BuilderFields";
import { HomeSeoFields, PolicyPages } from "./PageExtras";
import type { PolicyKind } from "@/lib/enums";

type Doc = { global: GlobalState; draft: StorePages };
type GlobalPart = "header" | "announcement" | "navigation" | "footer";
type Preview = {
  shopName: string;
  phone: string | null;
  locale: Locale;
  storeText: StoreText;
  currency: string;
  products: GridProduct[];
  collections: { id: string; handle: string; titles: CollectionTexts; image: string | null }[];
  badges: BadgeItem[];
  policies: { kind: string; title: string }[];
};

export const sectionIcons: Record<StoreSectionType, typeof LayoutGrid> = {
  hero: LayoutPanelTop,
  products: LayoutGrid,
  collections: LayoutGrid,
  badges: LayoutGrid,
  steps: LayoutGrid,
  text: FileText,
  imageText: LayoutPanelTop,
  faq: FileText,
  video: LayoutPanelTop,
  spacer: PanelBottom,
};

const toInput = (g: GlobalState) => ({
  primaryColor: g.primaryColor,
  logoUrl: g.logoUrl,
  announcementEnabled: g.announcementEnabled,
  announcementText: g.announcementText,
  navigationEnabled: g.navigationEnabled,
  links: g.links,
  showPhone: g.showPhone,
  footerEnabled: g.footerEnabled,
  styleFont: g.style.font,
  styleHeader: g.style.header,
  styleHero: g.style.hero,
  styleColumns: g.style.columns,
  styleImage: g.style.image,
  styleCards: g.style.cards,
  styleCorners: g.style.corners,
  about: g.about,
  facebook: g.facebook,
  instagram: g.instagram,
  tiktok: g.tiktok,
  telegram: g.telegram,
  whatsapp: g.whatsapp,
});

export function StoreBuilder({
  lang,
  initial,
  published: initialPublished,
  themeKey,
  preview,
  storeHref,
  backHref,
  themesHref,
  title,
  seo,
  policies,
  t,
}: {
  lang: string;
  initial: Doc;
  published: StorePages;
  themeKey: string;
  preview: Preview;
  storeHref: string;
  backHref: string;
  themesHref: string;
  title: string;
  seo: { title: string; description: string };
  policies: Partial<Record<PolicyKind, string>>;
  t: BuilderText;
}) {
  const d = t.design;
  const b = d.builder;
  const errors = t.errors as Record<string, string>;
  const [doc, setDoc] = useState(initial);
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);
  const [published, setPublished] = useState(initialPublished);
  const [pageId, setPageId] = useState("home");
  const [panel, setPanel] = useState<"sections" | "theme" | "pages">("sections");
  const [tab, setTab] = useState<"content" | "layout">("layout");
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [save, setSave] = useState<"saved" | "saving" | "unsaved" | "failed">("saved");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listDesignHistory>> | null>(null);
  const [pending, startTransition] = useTransition();
  const historyDialog = useModal();
  const pageDialog = useModal();
  const lastEdit = useRef("");
  const docRef = useRef(doc);
  const savedDoc = useRef(doc);

  const change = (fn: (x: Doc) => Doc, key = "") => {
    const merge = key !== "" && lastEdit.current === key;
    lastEdit.current = key;
    if (!merge) {
      setPast((p) => [...p, docRef.current].slice(-60));
      setFuture([]);
    }
    const next = fn(docRef.current);
    docRef.current = next;
    setDoc(next);
    setSave("unsaved");
    setMessage(null);
  };
  const jump = (to: Doc) => {
    docRef.current = to;
    setDoc(to);
    setSave("unsaved");
    lastEdit.current = "";
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([doc, ...future]);
    jump(prev);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, doc]);
    jump(next);
  };

  // Saves by itself a moment after the last change
  const persist = async () => {
    const x = docRef.current;
    if (x === savedDoc.current) return true;
    setSave("saving");
    const r = await saveStoreDesign(lang, { global: toInput(x.global), draft: x.draft }).catch(() => ({ ok: false as const, error: "unexpected", fieldErrors: undefined }));
    if (!r.ok) {
      setFieldErrors(("fieldErrors" in r && r.fieldErrors) || {});
      setSave("failed");
      return false;
    }
    setFieldErrors({});
    savedDoc.current = x;
    setSave(docRef.current === x ? "saved" : "unsaved");
    return true;
  };
  useEffect(() => {
    if (save !== "unsaved") return;
    const id = setTimeout(() => void persist(), 800);
    return () => clearTimeout(id);
  });
  const err = (field: string) => (fieldErrors[field] ? (errors[fieldErrors[field]] ?? errors.invalid) : undefined);

  const setGlobal = (patch: Partial<GlobalState>, key: string) => change((x) => ({ ...x, global: { ...x.global, ...patch } }), key ? `g.${key}` : "");
  const page = pageId === "home" ? null : (doc.draft.custom.find((p) => p.id === pageId) ?? null);
  const sections = page ? page.sections : doc.draft.home;
  const setSections = (fn: (all: StoreSection[]) => StoreSection[], key = "") =>
    change((x) => ({ ...x, draft: pageId === "home" ? { ...x.draft, home: fn(x.draft.home) } : { ...x.draft, custom: x.draft.custom.map((p) => (p.id === pageId ? { ...p, sections: fn(p.sections) } : p)) } }), key);
  const update = (id: string, patch: Partial<StoreSection>) => setSections((all) => all.map((s) => (s.id === id ? ({ ...s, ...patch } as StoreSection) : s)), `${pageId}:${id}:${Object.keys(patch).join(",")}`);
  const move = (id: string, by: number) =>
    setSections((all) => {
      const i = all.findIndex((s) => s.id === id);
      const next = [...all];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item);
      return next;
    });
  const remove = (id: string) => {
    if (!confirm(b.confirmRemove)) return;
    setSections((all) => all.filter((s) => s.id !== id));
    setSelected(null);
  };
  const add = (type: StoreSectionType) => {
    const s = newSection(type, type === "hero" ? { title: preview.shopName } : type === "products" ? { title: "" } : {});
    setSections((all) => {
      const at = selected ? all.findIndex((x) => x.id === selected) + 1 : 0;
      return at > 0 ? [...all.slice(0, at), s, ...all.slice(at)] : [...all, s];
    });
    setAdding(false);
    setSelected(s.id);
    setTab("content");
  };
  const select = (id: string) => {
    setSelected(id);
    setTab("content");
    setPanel("sections");
  };

  // Custom pages
  const addPage = () => {
    if (doc.draft.custom.length >= MAX_PAGES) return;
    const handles = new Set(doc.draft.custom.map((p) => p.handle));
    let handle = pageHandle(b.newPageTitle) || "page";
    for (let n = 2; handles.has(handle); n++) handle = `${pageHandle(b.newPageTitle) || "page"}-${n}`;
    const p = { id: newId("p"), title: b.newPageTitle, handle, sections: [newSection("text", { title: b.newPageTitle })] };
    change((x) => ({ ...x, draft: { ...x.draft, custom: [...x.draft.custom, p] } }));
    setPageId(p.id);
    setSelected(null);
    setTab("layout");
    setPanel("sections");
  };
  const setPage = (patch: { title?: string; handle?: string }) => change((x) => ({ ...x, draft: { ...x.draft, custom: x.draft.custom.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) } }), `page.${pageId}.${Object.keys(patch)[0]}`);
  const deletePage = () => {
    if (!page || !confirm(b.confirmDeletePage)) return;
    change((x) => ({ ...x, draft: { ...x.draft, custom: x.draft.custom.filter((p) => p.id !== page.id) } }));
    setPageId("home");
    setSelected(null);
    pageDialog.current?.close();
  };

  const publish = () =>
    startTransition(async () => {
      if (!(await persist())) return setMessage({ ok: false, text: b.saveFailed });
      const r = await publishStoreDesign(lang).catch(() => ({ ok: false as const, error: "unexpected" }));
      if (r.ok) {
        setPublished(docRef.current.draft);
        setMessage({ ok: true, text: b.publishedOk });
      } else setMessage({ ok: false, text: errors[r.error ?? "unexpected"] ?? errors.unexpected });
    });
  const discard = () => {
    if (samePages(doc.draft, published)) return setMessage({ ok: false, text: b.nothingToDiscard });
    if (!confirm(b.confirmDiscard)) return;
    startTransition(async () => {
      await persist();
      const p = await discardStoreDraft(lang);
      if (!p) return;
      const next = { ...docRef.current, draft: p };
      docRef.current = next;
      savedDoc.current = next;
      setDoc(next);
      setPast([]);
      setFuture([]);
      setSave("saved");
      if (pageId !== "home" && !p.custom.some((x) => x.id === pageId)) setPageId("home");
      setSelected(null);
    });
  };
  const openHistory = () => {
    setHistory(null);
    historyDialog.current?.showModal();
    startTransition(async () => setHistory(await listDesignHistory(lang)));
  };
  const restore = (id: string) =>
    startTransition(async () => {
      const p = await getDesignVersion(lang, id);
      if (!p) return;
      change((x) => ({ ...x, draft: p }));
      if (pageId !== "home" && !p.custom.some((x) => x.id === pageId)) setPageId("home");
      setSelected(null);
      historyDialog.current?.close();
      setMessage({ ok: true, text: b.restored });
    });

  const g = doc.global;
  const theme = storeTheme({ theme: themeKey, style: g.style });
  const color = /^#[0-9a-f]{6}$/i.test(g.primaryColor) ? g.primaryColor : initial.global.primaryColor;
  const isPublished = samePages(doc.draft, published);
  const current = sections.find((s) => s.id === selected) ?? null;
  const globalPart = selected?.startsWith("g:") ? (selected.slice(2) as GlobalPart) : null;
  const targets: Targets = {
    pages: doc.draft.custom.map((p) => ({ handle: p.handle, title: p.title })),
    collections: preview.collections.map((c) => ({ handle: c.handle, title: c.titles[preview.locale] || c.titles.ar || c.titles.fr || c.titles.en || c.handle })),
    policies: preview.policies,
  };
  const iconBtn = "grid size-9 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg disabled:opacity-30";
  const globalCard = (part: GlobalPart, Icon: typeof Menu) => (
    <button type="button" onClick={() => select(`g:${part}`)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start ${selected === `g:${part}` ? "bg-accent-soft ring-1 ring-accent/40" : "bg-panel-2/70 hover:bg-panel-2"}`} data-global={part}>
      <Icon size={16} className="mt-0.5 shrink-0 text-muted" />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {b[part]} <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-fg-2 uppercase">{b.global}</span>
        </span>
        <span className="block truncate text-xs text-muted">{b.applies}</span>
      </span>
    </button>
  );
  const globalRow = (part: "announcement" | "navigation" | "footer", on: boolean, field: "announcementEnabled" | "navigationEnabled" | "footerEnabled") => (
    <div className={`flex items-center gap-3 rounded-lg px-2 py-2 ${selected === `g:${part}` ? "bg-accent-soft" : "hover:bg-panel-2"}`}>
      <input type="checkbox" checked={on} onChange={(e) => setGlobal({ [field]: e.target.checked }, "")} className="size-4 accent-[var(--color-accent)]" aria-label={b[part]} data-toggle={part} />
      <button type="button" className="min-w-0 flex-1 truncate text-start text-sm" onClick={() => select(`g:${part}`)}>
        {b[part]}
      </button>
      <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-bold text-fg-2 uppercase">{b.global}</span>
    </div>
  );
  const groupLabel = (text: string) => <p className="px-2 pt-3 text-[11px] font-semibold tracking-wider text-muted uppercase">{text}</p>;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg text-fg" data-testid="store-builder">
      <h1 className="sr-only">{title}</h1>
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-line bg-panel px-3">
        <Link href={backHref} className={iconBtn} aria-label={b.back} title={b.back} data-testid="builder-back">
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </Link>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isPublished ? "bg-accent-soft text-accent-ink" : "bg-panel-2 text-muted"}`} data-testid="publish-state" data-published={isPublished}>
          {isPublished ? b.published : b.unpublished}
        </span>
        <label className="relative">
          <select value={pageId} onChange={(e) => { setPageId(e.target.value); setSelected(null); setTab("layout"); }} className="h-9 appearance-none rounded-lg border border-line bg-panel ps-3 pe-8 text-sm font-medium" aria-label={b.panels.pages} data-testid="page-picker">
            <option value="home">{b.home}</option>
            {doc.draft.custom.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-muted" />
        </label>
        <span className="hidden md:block">
          <Button variant="secondary" className="h-9 whitespace-nowrap" onClick={addPage} disabled={doc.draft.custom.length >= MAX_PAGES} data-testid="add-page">
            <Plus size={15} /> {b.addPage}
          </Button>
        </span>
        <button type="button" className={iconBtn} aria-label={b.pageSettings} title={b.pageSettings} onClick={() => pageDialog.current?.showModal()} data-testid="page-settings">
          <Settings size={17} />
        </button>
        <span className={`hidden text-xs whitespace-nowrap lg:inline ${save === "failed" ? "text-danger" : "text-muted"}`} data-testid="save-state" data-state={save}>
          {save === "saving" || save === "unsaved" ? b.saving : save === "failed" ? b.saveFailed : b.saved}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <div className="hidden items-center rounded-lg border border-line p-0.5 sm:flex">
            {(["desktop", "mobile"] as const).map((dev) => (
              <button key={dev} type="button" aria-pressed={device === dev} aria-label={dev === "desktop" ? d.desktop : d.mobile} onClick={() => setDevice(dev)} className={`grid size-8 place-items-center rounded-md ${device === dev ? "bg-ink text-white dark:bg-accent" : "text-muted"}`} data-device={dev}>
                {dev === "desktop" ? <Monitor size={15} /> : <Smartphone size={15} />}
              </button>
            ))}
          </div>
          <button type="button" className={iconBtn} onClick={undo} disabled={!past.length} aria-label={b.undo} title={b.undo} data-testid="undo">
            <Undo2 size={17} />
          </button>
          <button type="button" className={iconBtn} onClick={redo} disabled={!future.length} aria-label={b.redo} title={b.redo} data-testid="redo">
            <Redo2 size={17} />
          </button>
          <span className="hidden gap-1 lg:flex">
            <Button variant="secondary" className="h-9 whitespace-nowrap" disabled={pending} onClick={discard} data-testid="discard-draft">
              {b.discard}
            </Button>
            <Button variant="secondary" className="h-9 whitespace-nowrap" disabled={pending} onClick={openHistory} data-testid="open-history">
              <History size={15} /> {b.history}
            </Button>
          </span>
          <a href={page ? `${storeHref}/pages/${page.handle}` : storeHref} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium hover:bg-panel-2 md:flex" data-testid="preview-store">
            <ExternalLink size={15} /> {b.previewStore}
          </a>
          <Button className="h-9 shrink-0" disabled={pending} onClick={publish} data-testid="publish">
            {b.publish}
          </Button>
        </div>
      </header>
      {message && (
        <div className="shrink-0 px-4 pt-2" data-testid="builder-message">
          <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Icon rail */}
        <nav className="flex shrink-0 items-center gap-1 border-b border-line bg-panel px-3 py-1.5 md:w-12 md:flex-col md:border-e md:border-b-0 md:px-0 md:py-3">
          {([
            ["sections", PenLine],
            ["theme", Palette],
            ["pages", LayoutGrid],
          ] as const).map(([key, Icon]) => (
            <button key={key} type="button" aria-label={b.panels[key]} title={b.panels[key]} aria-pressed={panel === key} onClick={() => setPanel(key)} className={`grid size-9 place-items-center rounded-lg ${panel === key ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-2"}`} data-panel-button={key}>
              <Icon size={17} />
            </button>
          ))}
        </nav>

        {/* Panel */}
        <aside className="max-h-[45vh] w-full shrink-0 overflow-y-auto border-b border-line bg-panel md:max-h-none md:w-[19rem] md:border-e md:border-b-0" data-testid="builder-panel" data-panel={panel}>
          {panel === "sections" && (
            <>
              <div className="sticky top-0 z-10 grid grid-cols-2 gap-1 bg-panel p-2" role="tablist">
                {(["content", "layout"] as const).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg py-2 text-sm font-semibold ${tab === k ? "bg-ink text-white dark:bg-accent" : "text-muted hover:bg-panel-2"}`} data-tab={k}>
                    {b[k]}
                  </button>
                ))}
              </div>
              {tab === "layout" ? (
                <div className="space-y-1 p-2 pt-0" data-testid="layout-list">
                  {globalCard("header", LayoutPanelTop)}
                  {globalCard("announcement", Megaphone)}
                  {groupLabel(b.header)}
                  {globalRow("announcement", g.announcementEnabled, "announcementEnabled")}
                  {globalRow("navigation", g.navigationEnabled, "navigationEnabled")}
                  {groupLabel(b.sectionsLabel)}
                  {sections.length === 0 && <p className="px-2 py-2 text-xs text-muted">{b.noSections}</p>}
                  <ul className="space-y-0.5">
                    {sections.map((s, i) => {
                      const Icon = sectionIcons[s.type];
                      return (
                        <li key={s.id} className={`group flex items-center gap-2 rounded-lg px-2 py-2 ${selected === s.id ? "bg-accent-soft" : "hover:bg-panel-2"} ${s.hidden ? "opacity-50" : ""}`} data-section-row={s.type} data-section-id={s.id}>
                          <Icon size={15} className="shrink-0 text-muted" />
                          <button type="button" className="min-w-0 flex-1 truncate text-start text-sm" onClick={() => select(s.id)}>
                            {b.types[s.type]}
                            {"title" in s && s.title ? <span className="text-muted"> · {s.title}</span> : null}
                          </button>
                          <span className="flex items-center opacity-60 group-hover:opacity-100">
                            <button type="button" className="grid size-6 place-items-center rounded hover:bg-line" aria-label={s.hidden ? b.show : b.hide} title={s.hidden ? b.show : b.hide} onClick={() => update(s.id, { hidden: !s.hidden })} data-action="toggle-hidden">
                              {s.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button type="button" className="grid size-6 place-items-center rounded hover:bg-line disabled:opacity-30" aria-label={b.moveUp} disabled={i === 0} onClick={() => move(s.id, -1)} data-action="up">
                              <ArrowUp size={13} />
                            </button>
                            <button type="button" className="grid size-6 place-items-center rounded hover:bg-line disabled:opacity-30" aria-label={b.moveDown} disabled={i === sections.length - 1} onClick={() => move(s.id, 1)} data-action="down">
                              <ArrowDown size={13} />
                            </button>
                            <button type="button" className="grid size-6 place-items-center rounded text-danger hover:bg-danger-soft" aria-label={b.remove} onClick={() => remove(s.id)} data-action="remove">
                              <Trash2 size={13} />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {sections.length < MAX_SECTIONS && (
                    <div className="relative">
                      <button type="button" onClick={() => setAdding(!adding)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-muted hover:border-accent hover:text-accent" aria-expanded={adding} data-testid="add-section">
                        <Plus size={15} /> {b.addSection}
                      </button>
                      {adding && (
                        <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel p-1 shadow-lift" data-testid="section-types">
                          {storeSectionTypes.map((type) => {
                            const Icon = sectionIcons[type];
                            return (
                              <button key={type} type="button" onClick={() => add(type)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-start text-xs font-medium hover:bg-panel-2" data-add={type}>
                                <Icon size={14} className="shrink-0 text-muted" /> {b.types[type]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {groupLabel(b.footer)}
                  {globalRow("footer", g.footerEnabled, "footerEnabled")}
                  <div className="pt-1">{globalCard("footer", PanelBottom)}</div>
                </div>
              ) : (
                <div className="space-y-4 p-4 pt-2" data-testid="content-panel">
                  {globalPart ? (
                    <>
                      <p className="flex items-center gap-2 font-semibold">
                        {b[globalPart]} <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold text-fg-2 uppercase">{b.global}</span>
                      </p>
                      <p className="text-xs text-muted">{b.applies}</p>
                      <GlobalFields part={globalPart} g={g} set={setGlobal} t={t} err={err} targets={targets} />
                    </>
                  ) : current ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{b.types[current.type]}</p>
                        <span className="flex items-center gap-1">
                          <button type="button" className={iconBtn} aria-label={current.hidden ? b.show : b.hide} onClick={() => update(current.id, { hidden: !current.hidden })}>
                            {current.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          <button type="button" className={`${iconBtn} text-danger`} aria-label={b.remove} onClick={() => remove(current.id)}>
                            <Trash2 size={15} />
                          </button>
                        </span>
                      </div>
                      <SectionFields key={current.id} s={current} update={(p) => update(current.id, p)} t={t} collections={targets.collections.map((c, i) => ({ id: preview.collections[i].id, title: c.title }))} />
                    </>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{b.pickHint}</p>
                  )}
                </div>
              )}
            </>
          )}
          {panel === "theme" && (
            <div className="space-y-4 p-4" data-testid="theme-panel">
              <p className="font-semibold">{b.panels.theme}</p>
              <p className="text-xs text-muted">{b.themeHint}</p>
              <ThemeFields g={g} set={setGlobal} t={t} err={err} />
              <Link href={themesHref} className="block text-sm font-semibold text-accent hover:underline">
                {b.themeStore}
              </Link>
            </div>
          )}
          {panel === "pages" && (
            <div className="space-y-2 p-4" data-testid="pages-panel">
              <p className="font-semibold">{b.panels.pages}</p>
              <p className="text-xs text-muted">{b.pagesHint}</p>
              {[{ id: "home", title: b.home, handle: "" }, ...doc.draft.custom].map((p) => (
                <button key={p.id} type="button" onClick={() => { setPageId(p.id); setSelected(null); setTab("layout"); setPanel("sections"); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm ${pageId === p.id ? "bg-accent-soft font-semibold" : "hover:bg-panel-2"}`} data-page={p.handle || "home"}>
                  <FileText size={15} className="text-muted" /> <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {p.handle && <span dir="ltr" className="text-xs text-muted">/{p.handle}</span>}
                </button>
              ))}
              <Button variant="secondary" className="w-full" onClick={addPage} disabled={doc.draft.custom.length >= MAX_PAGES}>
                <Plus size={15} /> {b.addPage}
              </Button>
              <PolicyPages lang={lang} initial={policies} t={t} />
              <div className="grid grid-cols-2 gap-2 pt-2 lg:hidden">
                <Button variant="secondary" disabled={pending} onClick={discard}>
                  {b.discard}
                </Button>
                <Button variant="secondary" disabled={pending} onClick={openHistory}>
                  <History size={15} /> {b.history}
                </Button>
              </div>
            </div>
          )}
        </aside>

        {/* The store with the draft */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-panel-2/60 p-4 lg:p-6">
          <div className={`mx-auto overflow-hidden rounded-xl border border-dashed border-line bg-white shadow-sm ${device === "mobile" ? "max-w-[390px]" : ""}`} data-testid="design-preview" data-device={device}>
            <StoreFrame locale={preview.locale} color={color} theme={theme}>
              {g.announcementEnabled && g.announcementText && (
                <div role="button" tabIndex={-1} onClick={() => select("g:announcement")} className="cursor-pointer">
                  <div className="pointer-events-none">
                    <AnnouncementBar text={g.announcementText} />
                  </div>
                </div>
              )}
              <div role="button" tabIndex={-1} onClick={() => select("g:header")} className="cursor-pointer">
                <div className="pointer-events-none">
                  <StoreHeader
                    name={preview.shopName}
                    logoUrl={g.logoUrl || null}
                    phone={g.showPhone ? preview.phone : null}
                    whatsapp={g.whatsapp}
                    homeHref="#"
                    align={theme.layout.header}
                    t={preview.storeText}
                    links={!g.navigationEnabled ? [] : g.links.length ? g.links.map((l) => ({ label: l.label, href: navHref(l.target, "") })) : undefined}
                  />
                </div>
              </div>
              <div className="space-y-8 px-4 py-6">
                {page && <h1 className="text-3xl font-extrabold tracking-tight">{page.title}</h1>}
                <StoreSections
                  sections={sections}
                  data={{ products: preview.products, collections: preview.collections, badges: preview.badges, base: "", currency: preview.currency, locale: preview.locale, t: preview.storeText, layout: theme.layout }}
                  editing={{ selected, onSelect: select, emptyText: b.emptySection }}
                />
              </div>
              {g.footerEnabled && (
                <div role="button" tabIndex={-1} onClick={() => select("g:footer")} className="cursor-pointer">
                  <div className="pointer-events-none">
                    <StoreFooter name={preview.shopName} about={g.about} socials={{ facebook: g.facebook, instagram: g.instagram, tiktok: g.tiktok, whatsapp: g.whatsapp, telegram: g.telegram }} phone={preview.phone} t={preview.storeText} />
                  </div>
                </div>
              )}
            </StoreFrame>
          </div>
        </main>
      </div>

      {/* Page settings */}
      <dialog ref={pageDialog} className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="page-dialog">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-bold">{b.pageSettings}</h2>
          <button type="button" aria-label={b.close} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => pageDialog.current?.close()}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {page ? (
            <>
              <Field label={b.pageTitle} htmlFor="page-title">
                <Input id="page-title" maxLength={80} value={page.title} onChange={(e) => setPage({ title: e.target.value })} />
              </Field>
              <Field label={b.pageHandle} htmlFor="page-handle" hint={`${storeHref}/pages/${page.handle}`}>
                <Input id="page-handle" dir="ltr" maxLength={60} value={page.handle} onChange={(e) => setPage({ handle: pageHandle(e.target.value) || page.handle })} />
              </Field>
              <Button variant="secondary" className="w-full text-danger" onClick={deletePage} data-testid="delete-page">
                <Trash2 size={15} /> {b.deletePage}
              </Button>
            </>
          ) : (
            <HomeSeoFields lang={lang} initial={seo} shopName={preview.shopName} url={storeHref} t={t} />
          )}
        </div>
      </dialog>

      {/* History */}
      <dialog ref={historyDialog} className="m-auto w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="history-dialog">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-bold">{b.historyTitle}</h2>
          <button type="button" aria-label={b.close} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => historyDialog.current?.close()}>
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!history ? (
            <p className="p-4 text-center text-sm text-muted">…</p>
          ) : history.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">{b.historyEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((v) => (
                <li key={v.id} className="flex items-center gap-3 p-3 text-sm" data-history={v.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {formatDate(new Date(v.at), lang)} · {formatTime(new Date(v.at), lang)}
                    </span>
                    <span className="text-xs text-muted">
                      {fmt(b.historyRow, { pages: v.pages, sections: v.sections })}
                      {v.by ? ` · ${v.by}` : ""}
                    </span>
                  </span>
                  <Button variant="secondary" className="h-8" disabled={pending} onClick={() => restore(v.id)} data-action="restore">
                    {b.restore}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </div>
  );
}
