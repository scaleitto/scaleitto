"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CircleHelp,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  ImageIcon,
  LayoutTemplate,
  Lightbulb,
  List,
  LoaderCircle,
  Megaphone,
  Minus,
  MoreVertical,
  PartyPopper,
  Plus,
  Redo2,
  Save,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  Type,
  Undo2,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { currencyLabel, type StoreText } from "@/i18n/store";
import type { RateMap } from "@/features/checkout/pricing";
import { fmt } from "@/lib/format";
import { Alert, Button, Field, Input, Select, Textarea } from "@/ui";
import { StoreFrame } from "@/features/storefront/blocks";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import type { Theme } from "@/features/themes/themes";
import { dir } from "@/i18n/config";
import { useModal } from "@/ui/useModal";
import { LandingSections } from "./blocks";
import { SectionFields, type EditorText } from "./SectionFields";
import { discardLandingChanges, getHistoryEntry, listHistory, pageVersionStats, publishLandingPage, saveLandingDraft } from "./actions";
import { checkAiLanding, startAiVersion } from "./ai-actions";
import { newImage, newSectionId, sectionTypes, type FormSettings, type LandingSection, type PageVariant, type SectionType, type VersionKey } from "./types";

type Product = Parameters<typeof CheckoutForm>[0]["product"];
type Variant = Parameters<typeof CheckoutForm>[0]["variants"][number];
type Content = { sections: LandingSection[]; variants: PageVariant[] };
type Doc = { title: string; slug: string; metaDescription: string; pixels: Record<string, string[]> | null; content: Content };
type Pixel = { id: string; platform: string; name: string };

export const componentIcons: Record<SectionType, LucideIcon> = {
  image: ImageIcon,
  text: Type,
  form: ShoppingCart,
  sticky: ShoppingCart,
  thankYou: PartyPopper,
  countdown: Clock,
  reviews: Star,
  badges: ShieldCheck,
  faq: CircleHelp,
  spacer: Minus,
  bullets: List,
  video: Video,
  announcement: Megaphone,
};
// One of these per page
const single: SectionType[] = ["form", "sticky", "thankYou"];
const suggestionTypes = ["reviews", "countdown", "badges", "sticky"] as const;

function newComponent(type: SectionType, t: StoreText): LandingSection {
  const id = newSectionId();
  switch (type) {
    case "image":
      return newImage();
    case "text":
      return { id, type, title: "", body: "", align: "center", size: "md" };
    case "form":
      return { id, type };
    case "sticky":
      return { id, type, label: "" };
    case "thankYou":
      return { id, type, title: "", message: "" };
    case "countdown":
      return { id, type, endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() };
    case "reviews":
      return { id, type, items: [{ name: "", text: "", rating: 5 }] };
    case "badges":
      return { id, type, items: t.landing.defaults.badges.map((text, i) => ({ icon: (["truck", "banknote", "phone", "shield"] as const)[i % 4], text })) };
    case "faq":
      return { id, type, items: [{ q: "", a: "" }] };
    case "spacer":
      return { id, type, size: 32, line: true };
    case "bullets":
      return { id, type, items: [], style: "check" };
    case "video":
      return { id, type, url: "" };
    case "announcement":
      return { id, type, text: "", scrolling: false };
  }
}
const copyOf = (s: LandingSection): LandingSection => ({ ...structuredClone(s), id: newSectionId() });

// Zimam's builder: a top bar (back, name, save state, versions, open, undo/redo, history, discard, publish), the
// components with "Improve with AI", SEO and pixels (left), the page in a phone (middle, a click selects a block),
// the selected component's settings and suggestions (right). The builder saves as it goes; visitors only see what
// was published.
export function LandingEditor({
  lang,
  pageId,
  initial,
  live,
  hasPublished,
  product,
  variants,
  rates,
  storeText,
  pageLocale,
  theme,
  color,
  pageUrl,
  backHref,
  form,
  pixels,
  library,
  t,
}: {
  lang: string;
  pageId: string;
  initial: Doc;
  live: boolean;
  hasPublished: boolean;
  product: Product;
  variants: Variant[];
  rates: RateMap;
  storeText: StoreText;
  pageLocale: "ar" | "fr" | "en";
  theme: Theme;
  color: string;
  pageUrl: string;
  backHref: string;
  form: FormSettings;
  pixels: Pixel[];
  library: string[];
  t: EditorText;
}) {
  const ed = t.landingPages.editor;
  const errors = t.errors as Record<string, string>;
  const [doc, setDoc] = useState(initial);
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);
  const [version, setVersion] = useState<VersionKey>("A");
  const [selected, setSelected] = useState<string | null>(null);
  const [save, setSave] = useState<"saved" | "saving" | "unsaved" | "failed">("saved");
  const [isLive, setLive] = useState(live);
  const [published, setPublished] = useState(hasPublished);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listHistory>> | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof pageVersionStats>>>(null);
  const [ai, setAi] = useState<{ working: boolean; step: string; error: string | null }>({ working: false, step: "", error: null });
  const [pixelsOpen, setPixelsOpen] = useState(false);
  const historyDialog = useModal();
  // Typing in one field is one step of the undo history, not one per letter
  const lastEdit = useRef("");
  const docRef = useRef(doc);
  const savedDoc = useRef(doc);

  const change = (fn: (d: Doc) => Doc, key = "") => {
    const merge = key !== "" && lastEdit.current === key;
    lastEdit.current = key;
    if (!merge) {
      setPast((p) => [...p, doc].slice(-60));
      setFuture([]);
    }
    const next = fn(doc);
    docRef.current = next;
    setDoc(next);
    setSave("unsaved");
    setMessage(null);
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([doc, ...future]);
    docRef.current = prev;
    setDoc(prev);
    setSave("unsaved");
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, doc]);
    docRef.current = next;
    setDoc(next);
    setSave("unsaved");
  };

  // The builder saves by itself a moment after the last change
  const persist = async () => {
    const d = docRef.current;
    if (d === savedDoc.current) return true;
    setSave("saving");
    const r = await saveLandingDraft(lang, pageId, { title: d.title, slug: d.slug, metaDescription: d.metaDescription, sections: d.content.sections, variants: d.content.variants, pixels: d.pixels }).catch(() => ({ ok: false as const, error: "unexpected" }));
    if (!r.ok) {
      setSave("failed");
      return false;
    }
    savedDoc.current = d;
    // The store may have changed the link to keep it unique
    if ("message" in r && r.message && r.message !== d.slug && d.slug) setDoc((cur) => (cur === d ? { ...cur, slug: r.message! } : cur));
    setSave(docRef.current === d ? "saved" : "unsaved");
    return true;
  };
  useEffect(() => {
    if (save !== "unsaved" && save !== "failed") return;
    const id = setTimeout(() => void persist(), save === "failed" ? 5000 : 1200);
    return () => clearTimeout(id);
  });

  const keys: VersionKey[] = ["A", ...doc.content.variants.map((v) => v.key)];
  const sections = version === "A" ? doc.content.sections : (doc.content.variants.find((v) => v.key === version)?.sections ?? doc.content.sections);
  const setSections = (fn: (all: LandingSection[]) => LandingSection[], key = "") =>
    change((d) => ({ ...d, content: version === "A" ? { ...d.content, sections: fn(d.content.sections) } : { ...d.content, variants: d.content.variants.map((v) => (v.key === version ? { ...v, sections: fn(v.sections) } : v)) } }), key);
  const update = (id: string, patch: Partial<LandingSection>) => setSections((all) => all.map((s) => (s.id === id ? ({ ...s, ...patch } as LandingSection) : s)), `${version}:${id}:${Object.keys(patch).join(",")}`);
  const move = (id: string, by: number) =>
    setSections((all) => {
      const i = all.findIndex((s) => s.id === id);
      const next = [...all];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item);
      return next;
    });
  const remove = (id: string) => {
    setSections((all) => all.filter((s) => s.id !== id));
    setSelected(null);
  };
  const duplicate = (id: string) =>
    setSections((all) => {
      const i = all.findIndex((s) => s.id === id);
      if (i < 0 || single.includes(all[i].type)) return all;
      return [...all.slice(0, i + 1), copyOf(all[i]), ...all.slice(i + 1)];
    });
  // A new component goes after the selected one, else before the form (sticky button / thank-you at the end)
  const add = (type: SectionType) => {
    const c = newComponent(type, storeText);
    setSections((all) => {
      const at = selected ? all.findIndex((s) => s.id === selected) + 1 : single.includes(type) && type !== "form" ? -1 : all.findIndex((s) => s.type === "form");
      return at <= 0 ? (at === 0 ? [c, ...all] : [...all, c]) : [...all.slice(0, at), c, ...all.slice(at)];
    });
    setSelected(c.id);
  };

  // Versions: a copy of the current one (paused), pause / run, delete
  const freeKey = (["B", "C"] as const).find((k) => !doc.content.variants.some((v) => v.key === k));
  const addVersion = (from: LandingSection[]) => {
    if (!freeKey) return;
    const key = freeKey;
    change((d) => ({ ...d, content: { ...d.content, variants: [...d.content.variants, { key, sections: from.map(copyOf), paused: true }] } }));
    setVersion(key);
    setSelected(null);
  };
  const setPaused = (key: VersionKey, paused: boolean) => change((d) => ({ ...d, content: { ...d.content, variants: d.content.variants.map((v) => (v.key === key ? { ...v, paused } : v)) } }));
  const deleteVersion = (key: VersionKey) => {
    if (!confirm(ed.confirmDeleteVersion)) return;
    change((d) => ({ ...d, content: { ...d.content, variants: d.content.variants.filter((v) => v.key !== key) } }));
    setVersion("A");
    setSelected(null);
  };

  const publish = () =>
    startTransition(async () => {
      if (!(await persist())) return setMessage({ ok: false, text: errors.unexpected });
      const r = await publishLandingPage(lang, pageId).catch(() => ({ ok: false as const, error: "unexpected" }));
      if (r.ok) {
        setLive(true);
        setPublished(true);
        setMessage({ ok: true, text: ed.publishedOk });
      } else setMessage({ ok: false, text: errors[r.error ?? "unexpected"] ?? errors.unexpected });
    });
  const discard = () => {
    if (!published) return setMessage({ ok: false, text: ed.nothingToDiscard });
    if (!confirm(ed.confirmDiscard)) return;
    startTransition(async () => {
      const p = await discardLandingChanges(lang, pageId);
      if (!p) return;
      const next = { ...docRef.current, content: { sections: p.sections, variants: p.variants } };
      docRef.current = next;
      savedDoc.current = next;
      setDoc(next);
      setPast([]);
      setFuture([]);
      setSelected(null);
      setVersion("A");
      setSave("saved");
    });
  };
  const openHistory = () => {
    setHistory(null);
    historyDialog.current?.showModal();
    startTransition(async () => setHistory(await listHistory(lang, pageId)));
  };
  const restore = (entryId: string) =>
    startTransition(async () => {
      const v = await getHistoryEntry(lang, pageId, entryId);
      if (!v) return;
      change((d) => ({ ...d, title: v.title, content: { sections: v.sections, variants: v.variants } }));
      setVersion("A");
      setSelected(null);
      historyDialog.current?.close();
      setMessage({ ok: true, text: ed.restored });
    });

  // "Improve with AI": another version, added paused when its images are drawn
  const improve = async () => {
    if (!freeKey) return setAi({ working: false, step: "", error: errors.versionsFull });
    setAi({ working: true, step: "", error: null });
    const r = await startAiVersion(lang, pageId).catch(() => ({ ok: false as const, error: "unexpected" }));
    if (!r.ok) return setAi({ working: false, step: "", error: `${errors[r.error] ?? errors.unexpected}${"message" in r && r.message ? `: ${r.message}` : ""}` });
    const t0 = Date.now();
    while (Date.now() - t0 < 12 * 60_000) {
      await new Promise((res) => setTimeout(res, 3000));
      const c = await checkAiLanding(lang, r.generationId).catch(() => ({ state: "pending" as const }));
      if (c.state === "failed") return setAi({ working: false, step: "", error: `${errors[c.error] ?? errors.unexpected}${c.message ? `: ${c.message}` : ""}` });
      if (c.state === "pending") setAi({ working: true, step: "total" in c && c.total ? `${c.done ?? 0}/${c.total}` : "", error: null });
      if (c.state === "done") {
        const key = (["B", "C"] as const).find((k) => !docRef.current.content.variants.some((v) => v.key === k));
        if (!key) return setAi({ working: false, step: "", error: errors.versionsFull });
        const cur = docRef.current;
        const next = { ...cur, content: { ...cur.content, variants: [...cur.content.variants, { key, sections: c.sections ?? [], paused: true }] } };
        setPast((p) => [...p, cur]);
        docRef.current = next;
        setDoc(next);
        setSave("unsaved");
        setVersion(key);
        setSelected(null);
        setAi({ working: false, step: "", error: null });
        setMessage({ ok: true, text: fmt(ed.improve.done, { k: key }) });
        return;
      }
    }
    setAi({ working: false, step: "", error: errors.aiFailed });
  };

  const current = sections.find((s) => s.id === selected) ?? null;
  const has = (type: SectionType) => sections.some((s) => s.type === type);
  const suggestions = suggestionTypes.filter((k) => !has(k) && !dismissed.includes(k));
  const platforms = [...new Set(pixels.map((p) => p.platform))];
  const variant = doc.content.variants.find((v) => v.key === version);
  const iconBtn = "grid size-9 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-fg disabled:opacity-30";
  const labels = { placeholder: ed.placeholder, thankYou: ed.thankYouLabel, emptyText: ed.empty.text, emptyReviews: ed.empty.reviews, emptyFaq: ed.empty.faq, emptyBadges: ed.empty.badges, emptyBullets: ed.empty.bullets, emptyVideo: ed.empty.video };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg text-fg" data-testid="landing-builder">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:px-4">
        <Link href={backHref} className={iconBtn} aria-label={ed.back} title={ed.back} data-testid="builder-back">
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </Link>
        <LayoutTemplate size={20} className="hidden shrink-0 text-accent sm:block" />
        <input
          value={doc.title}
          maxLength={200}
          onChange={(e) => change((d) => ({ ...d, title: e.target.value }), "title")}
          aria-label={ed.seo.pageName}
          className="w-28 min-w-0 truncate rounded-md bg-transparent px-1 py-1 text-base font-bold outline-none hover:bg-panel-2 focus:bg-panel-2 sm:w-48"
          data-testid="page-title"
        />
        <span className={`hidden text-xs whitespace-nowrap sm:inline ${save === "failed" ? "text-danger" : "text-muted"}`} data-testid="save-state" data-state={save}>
          {save === "saving" ? ed.saving : save === "unsaved" ? ed.unsaved : save === "failed" ? ed.saveFailed : ed.saved}
        </span>
        {/* Versions */}
        <div className="ms-1 flex items-center rounded-lg border border-line" data-testid="versions">
          {keys.map((k) => {
            const v = doc.content.variants.find((x) => x.key === k);
            return (
              <div key={k} className={`flex items-center ${k === version ? "bg-ink text-white dark:bg-accent" : ""} first:rounded-s-lg`}>
                <button
                  type="button"
                  onClick={() => {
                    setVersion(k);
                    setSelected(null);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
                  aria-pressed={k === version}
                  data-version={k}
                  data-paused={v?.paused ? "true" : "false"}
                >
                  <span className={`size-2 rounded-full ${v?.paused ? "bg-line" : "bg-emerald-500"}`} />
                  {fmt(ed.version, { k })}
                </button>
                <details
                  className="relative"
                  onToggle={(e) => {
                    if ((e.target as HTMLDetailsElement).open) startTransition(async () => setStats(await pageVersionStats(lang, pageId)));
                  }}
                >
                  <summary className="cursor-pointer list-none px-1 py-1.5 [&::-webkit-details-marker]:hidden" aria-label={ed.versionMenu} data-version-menu={k}>
                    <MoreVertical size={14} />
                  </summary>
                  <div className="absolute start-0 top-9 z-50 w-60 space-y-0.5 rounded-xl border border-line bg-panel p-1 text-sm text-fg shadow-lift">
                    <p className="px-3 py-1.5 text-xs text-muted">{stats ? fmt(ed.versionStats, { views: stats.find((x) => x.key === k)?.views ?? 0, orders: stats.find((x) => x.key === k)?.orders ?? 0 }) : "…"}</p>
                    {freeKey && (
                      <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-panel-2" onClick={() => addVersion(k === "A" ? doc.content.sections : (v?.sections ?? []))}>
                        <Copy size={14} className="text-muted" /> {ed.duplicateVersion}
                      </button>
                    )}
                    {v && (
                      <>
                        <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-panel-2" onClick={() => setPaused(k, !v.paused)} data-action="toggle-pause">
                          {v.paused ? <Eye size={14} className="text-muted" /> : <EyeOff size={14} className="text-muted" />} {v.paused ? ed.resume : ed.pause}
                        </button>
                        <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-danger hover:bg-danger-soft" onClick={() => deleteVersion(k)} data-action="delete-version">
                          <Trash2 size={14} /> {ed.deleteVersion}
                        </button>
                      </>
                    )}
                  </div>
                </details>
              </div>
            );
          })}
          <button type="button" disabled={!freeKey} onClick={() => addVersion(sections)} className="grid size-8 place-items-center border-s border-line text-muted hover:text-fg disabled:opacity-30" title={ed.addVersion} aria-label={ed.addVersion} data-testid="add-version">
            <Plus size={15} />
          </button>
        </div>
        <div className="ms-auto flex items-center gap-1">
          {isLive ? (
            <a href={pageUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-panel-2 md:flex" data-testid="open-page">
              <ExternalLink size={15} /> {ed.open}
            </a>
          ) : (
            <span className="hidden cursor-not-allowed items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted opacity-60 md:flex" title={ed.notLive}>
              <ExternalLink size={15} /> {ed.open}
            </span>
          )}
          <button type="button" className={iconBtn} onClick={undo} disabled={!past.length} aria-label={ed.undo} title={ed.undo} data-testid="undo">
            <Undo2 size={17} />
          </button>
          <button type="button" className={iconBtn} onClick={redo} disabled={!future.length} aria-label={ed.redo} title={ed.redo} data-testid="redo">
            <Redo2 size={17} />
          </button>
          <Button variant="secondary" className="hidden lg:inline-flex" disabled={pending} onClick={openHistory} data-testid="open-history">
            <History size={15} /> {ed.history}
          </Button>
          <Button variant="secondary" className="hidden lg:inline-flex" disabled={pending} onClick={discard} data-testid="discard-changes">
            {ed.discard}
          </Button>
          <Button disabled={pending} onClick={publish} data-testid="publish">
            <Save size={15} /> {ed.publish}
          </Button>
        </div>
      </header>
      <p className="shrink-0 border-b border-warning/30 bg-warning-soft px-4 py-2 text-xs text-warning">{ed.banner}</p>
      {message && (
        <div className="shrink-0 px-4 pt-2">
          <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        {/* Left: components, Improve with AI, SEO, pixels */}
        <aside className="hidden min-h-0 space-y-5 overflow-y-auto border-e border-line bg-panel p-4 lg:block" data-testid="components">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{ed.components}</p>
            {sectionTypes.map((type) => {
              const Icon = componentIcons[type];
              const disabled = single.includes(type) && has(type);
              return (
                <button key={type} type="button" disabled={disabled} onClick={() => add(type)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 text-start text-sm font-medium transition hover:border-accent/40 hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40" data-add={type}>
                  <span className="grid size-8 place-items-center rounded-lg bg-panel-2 text-muted">
                    <Icon size={16} />
                  </span>
                  {ed.types[type]}
                </button>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border border-line bg-panel-2/60 p-3" data-testid="improve-ai">
            <p className="flex items-center gap-2 font-semibold">
              <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg">
                <Sparkles size={15} />
              </span>
              {ed.improve.title}
              <span className="rounded-full border border-warning/40 bg-warning-soft px-2 text-[10px] font-bold text-warning uppercase">{ed.improve.beta}</span>
            </p>
            <p className="text-xs text-muted">{ed.improve.hint}</p>
            <div className="space-y-2 rounded-lg border border-line bg-panel p-3">
              <p className="text-xs text-muted">{ed.improve.versionHint}</p>
              <Button type="button" className="w-full bg-ink text-white hover:bg-ink/90" disabled={ai.working} onClick={improve} data-testid="ai-version">
                {ai.working ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} {ai.working ? fmt(ed.improve.working, { step: ai.step }) : ed.improve.generate}
              </Button>
              {ai.error && <p className="text-xs text-danger">{ai.error}</p>}
            </div>
            <p className="text-xs text-muted">{ed.improve.posterHint}</p>
          </div>

          <div className="space-y-3 rounded-xl border border-line p-3" data-testid="seo">
            <p className="flex items-center gap-2 font-semibold">
              <Settings size={15} className="text-muted" /> {ed.seo.title}
            </p>
            <Field label={ed.seo.slug} hint={ed.seo.slugHint}>
              <Input dir="ltr" value={doc.slug} maxLength={120} placeholder="summer-sale" onChange={(e) => change((d) => ({ ...d, slug: e.target.value.toLowerCase() }), "slug")} data-field="slug" />
            </Field>
            <Field label={ed.seo.meta} hint={`${ed.seo.metaHint} ${doc.metaDescription.length}/300`}>
              <Textarea rows={3} maxLength={300} value={doc.metaDescription} onChange={(e) => change((d) => ({ ...d, metaDescription: e.target.value }), "meta")} data-field="meta" />
            </Field>
          </div>

          <div className="space-y-3 border-t border-line pt-3" data-testid="page-pixels">
            <button type="button" onClick={() => setPixelsOpen(!pixelsOpen)} className="flex w-full items-center justify-between text-[11px] font-semibold tracking-wider text-muted uppercase" aria-expanded={pixelsOpen}>
              {ed.pixels.title} <span className="text-base">{pixelsOpen ? "−" : "+"}</span>
            </button>
            {pixelsOpen && (
              <>
                <p className="text-xs text-muted">{ed.pixels.hint}</p>
                {platforms.length === 0 && <p className="text-xs text-muted">{ed.pixels.noPixels}</p>}
                {platforms.map((platform) => {
                  const chosen = doc.pixels?.[platform];
                  const value = chosen === undefined ? "all" : chosen.length === 0 ? "none" : chosen[0];
                  return (
                    <Field key={platform} label={ed.pixels.platforms[platform as keyof typeof ed.pixels.platforms] ?? platform}>
                      <Select
                        value={value}
                        data-pixel-platform={platform}
                        onChange={(e) =>
                          change((d) => {
                            const next = { ...(d.pixels ?? {}) };
                            if (e.target.value === "all") delete next[platform];
                            else next[platform] = e.target.value === "none" ? [] : [e.target.value];
                            return { ...d, pixels: Object.keys(next).length ? next : null };
                          })
                        }
                      >
                        <option value="all">{ed.pixels.all}</option>
                        {pixels
                          .filter((p) => p.platform === platform)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        <option value="none">{ed.pixels.none}</option>
                      </Select>
                    </Field>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* Middle: the page in a phone; a click selects a block */}
        <main className="min-h-0 overflow-y-auto bg-panel-2/70 p-4 sm:p-8">
          {/* Small screens: the components as a row */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {sectionTypes.map((type) => (
              <button key={type} type="button" disabled={single.includes(type) && has(type)} onClick={() => add(type)} className="shrink-0 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                + {ed.types[type]}
              </button>
            ))}
          </div>
          <div className="mx-auto w-full max-w-[390px] rounded-[2.6rem] border-[10px] border-slate-800 bg-slate-800 shadow-2xl">
            <div
              className="h-[min(760px,calc(100vh-11rem))] overflow-y-auto rounded-[2rem] bg-white"
              data-testid="landing-preview"
              data-version={version}
              onClickCapture={(e) => {
                const el = e.target as HTMLElement;
                if (el.closest("[data-block-tool]")) return;
                e.preventDefault();
                e.stopPropagation();
                const id = el.closest<HTMLElement>("[data-sid]")?.dataset.sid;
                if (id) setSelected(id);
              }}
            >
              <StoreFrame locale={pageLocale} color={color} theme={theme}>
                <div lang={pageLocale} dir={dir(pageLocale)}>
                  <LandingSections
                    editing
                    selected={selected}
                    sections={sections}
                    t={storeText}
                    labels={labels}
                    toolbar={(id) => {
                      const s = sections.find((x) => x.id === id)!;
                      const i = sections.indexOf(s);
                      const tool = "grid size-7 place-items-center rounded-md bg-white text-slate-700 shadow ring-1 ring-black/10 hover:text-emerald-600 disabled:opacity-30";
                      return (
                        <div className="absolute end-2 top-2 z-20 flex gap-1" data-block-tool dir="ltr">
                          <button type="button" className={tool} disabled={i === 0} onClick={() => move(id, -1)} aria-label={ed.toolbar.up} title={ed.toolbar.up}>
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" className={tool} disabled={i === sections.length - 1} onClick={() => move(id, 1)} aria-label={ed.toolbar.down} title={ed.toolbar.down}>
                            <ArrowDown size={14} />
                          </button>
                          {!single.includes(s.type) && (
                            <button type="button" className={tool} onClick={() => duplicate(id)} aria-label={ed.toolbar.duplicate} title={ed.toolbar.duplicate} data-tool="duplicate">
                              <Copy size={14} />
                            </button>
                          )}
                          <button type="button" className={tool} onClick={() => update(id, { hidden: !s.hidden })} aria-label={s.hidden ? ed.toolbar.show : ed.toolbar.hide} title={s.hidden ? ed.toolbar.show : ed.toolbar.hide} data-tool="hide">
                            {s.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button type="button" className={`${tool} hover:text-red-600`} onClick={() => remove(id)} aria-label={ed.toolbar.remove} title={ed.toolbar.remove} data-tool="remove">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    }}
                    form={
                      <div className="pointer-events-none">
                        <CheckoutForm t={storeText} currency={currencyLabel(pageLocale)} product={product} variants={variants} rates={rates} wilayas={[]} action={async () => ({ ok: false })} saveLead={async () => {}} settings={{ ...form, appearance: "direct", stickyButton: false }} embedded />
                      </div>
                    }
                  />
                </div>
              </StoreFrame>
            </div>
          </div>
          {variant?.paused && <p className="mt-3 text-center text-xs text-muted">{fmt(ed.version, { k: version })} · {ed.paused}</p>}
        </main>

        {/* Right: the selected component's settings, then suggestions */}
        <aside className="min-h-0 space-y-4 overflow-y-auto border-s border-line bg-panel p-4" data-testid="section-panel" data-selected={current?.type ?? ""}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{ed.settings}</h2>
            {current && (
              <button type="button" className="rounded-lg p-2 text-danger hover:bg-danger-soft" onClick={() => remove(current.id)} aria-label={ed.toolbar.remove} title={ed.toolbar.remove} data-testid="panel-delete">
                <Trash2 size={17} />
              </button>
            )}
          </div>
          {!current ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted">
              <Settings size={28} className="opacity-50" />
              {ed.selectHint}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft p-3">
                <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-fg">
                  {(() => {
                    const Icon = componentIcons[current.type];
                    return <Icon size={18} />;
                  })()}
                </span>
                <span>
                  <span className="block font-semibold text-accent-ink">{ed.types[current.type]}</span>
                  <span className="text-xs text-muted">{ed.componentSettings}</span>
                </span>
              </div>
              <SectionFields
                key={`${version}:${current.id}`}
                lang={lang}
                pageId={pageId}
                section={current}
                set={(patch) => update(current.id, patch)}
                library={library}
                t={t}
              />
            </>
          )}
          {suggestions.length > 0 && (
            <div className="space-y-2 rounded-xl border border-line p-3" data-testid="suggestions">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb size={15} className="text-warning" /> {ed.suggestions}
                <span className="ms-auto grid size-5 place-items-center rounded-full bg-warning text-[10px] font-bold text-white">{suggestions.length}</span>
              </p>
              {suggestions.map((k) => (
                <div key={k} className="relative rounded-lg border border-warning/30 bg-warning-soft p-3" data-suggest={k}>
                  <button type="button" className="absolute end-2 top-2 text-warning/70 hover:text-warning" onClick={() => setDismissed([...dismissed, k])} aria-label={ed.dismiss}>
                    <X size={14} />
                  </button>
                  <button type="button" className="block pe-5 text-start" onClick={() => add(k)}>
                    <span className="block text-sm font-semibold text-warning">{ed.suggest[k][0]}</span>
                    <span className="block text-xs text-fg-2">{ed.suggest[k][1]}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <dialog ref={historyDialog} className="m-auto w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="history-dialog">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-bold">{ed.historyTitle}</h2>
          <button type="button" aria-label={t.landingPages.close} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => historyDialog.current?.close()}>
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!history ? (
            <p className="p-4 text-sm text-muted">{t.common.loading}</p>
          ) : history.length === 0 ? (
            <p className="p-4 text-sm text-muted">{ed.historyEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((v) => (
                <li key={v.id} className="flex items-center gap-3 p-3 text-sm" data-history={v.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{v.title}</span>
                    <span className="block text-xs text-muted">
                      {new Date(v.at).toLocaleString(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-DZ" : "en-GB", { timeZone: "Africa/Algiers", dateStyle: "medium", timeStyle: "short" })}
                      {v.by ? ` · ${v.by}` : ""} · {fmt(ed.historyLine, { n: v.count, v: v.versions })}
                    </span>
                  </span>
                  <Button type="button" variant="secondary" disabled={pending} onClick={() => restore(v.id)} data-testid="restore-version">
                    {ed.restore}
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
