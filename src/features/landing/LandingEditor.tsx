"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Check, ExternalLink, Eye, EyeOff, History, Lightbulb, Monitor, Plus, Smartphone, Trash2, Undo2, X } from "lucide-react";
import { currencyLabel, type StoreText } from "@/i18n/store";
import type { RateMap } from "@/features/checkout/pricing";
import type { ActionState } from "@/lib/action";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/ui";
import { StoreFrame } from "@/features/storefront/blocks";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import type { Theme } from "@/features/themes/themes";
import { dir } from "@/i18n/config";
import { LandingSections, isImagePage } from "./blocks";
import { PriceTag } from "./PriceTag";
import { SectionFields, type EditorText } from "./SectionFields";
import { getVersion, listVersions, saveLandingPage, type LandingDraft } from "./actions";
import { fmt } from "@/lib/format";
import { interfaceLocale, newSectionId, pageLanguages, sanitizeSections, sectionTypes, type FormSettings, type LandingSection, type PageLanguage, type SectionType } from "./types";
import { useModal } from "@/ui/useModal";

type Product = Parameters<typeof CheckoutForm>[0]["product"] & { name: string; compareAtPrice: number | null; images: string[] };
type Variant = Parameters<typeof CheckoutForm>[0]["variants"][number];
type Initial = { title: string; slug: string; language: PageLanguage; color: string | null; status: "draft" | "published"; sections: LandingSection[]; formTemplateId: string | null };
// The forms the page can use (all made in Store design → Order form): the product's own form and the store's templates
type Forms = { product: FormSettings; templates: { id: string; name: string; form: FormSettings }[]; editHref: string };

function newSection(type: SectionType, t: StoreText): LandingSection {
  const id = newSectionId();
  switch (type) {
    case "poster":
      return { id, type, image: "", kind: "details", headline: "", bullets: [], previous: [] };
    case "marquee":
      return { id, type, items: t.landing.defaults.badges };
    case "hero":
      return { id, type, title: "" };
    case "badges":
      return { id, type, items: t.landing.defaults.badges };
    case "text":
      return { id, type, body: "" };
    case "imageText":
      return { id, type, title: "", body: "" };
    case "benefits":
      return { id, type, items: [{ icon: "sparkles", title: "", text: "" }] };
    case "image":
      return { id, type, url: "" };
    case "gallery":
      return { id, type, images: [] };
    case "features":
      return { id, type, items: [] };
    case "steps":
      return { id, type, items: t.landing.defaults.steps };
    case "faq":
      return { id, type, items: [{ q: "", a: "" }] };
    case "reviews":
      return { id, type, items: [{ name: "", text: "", rating: 5 }] };
    case "video":
      return { id, type, url: "" };
    case "countdown":
      return { id, type, endsAt: new Date(Date.now() + 3 * 86400_000).toISOString() };
    case "cta":
      return { id, type, title: t.landing.defaults.cta };
    case "form":
      return { id, type };
    case "announcement":
      return { id, type, text: "" };
    case "spacer":
      return { id, type, size: "md", line: true };
  }
}

// A one-line reminder of what a section contains, shown on its collapsed card.
function summary(s: LandingSection) {
  switch (s.type) {
    case "poster":
      return `${s.image ? "🖼" : "⏳"} ${s.headline}`;
    case "marquee":
      return s.items.join(" · ");
    case "hero":
    case "cta":
      return s.title;
    case "text":
    case "imageText":
      return s.title || s.body;
    case "benefits":
      return s.items.map((x) => x.title).join(" · ");
    case "badges":
    case "features":
    case "steps":
      return s.items.filter(Boolean).join(" · ");
    case "faq":
      return s.items.map((x) => x.q).join(" · ");
    case "reviews":
      return s.items.map((x) => x.name).join(" · ");
    case "gallery":
      return `${s.images.length} 🖼`;
    default:
      return "";
  }
}

// Zimam's builder: components to add (left) with the page's order and suggestions, the live page in the middle (a click
// selects a block), the selected block's settings (right); on top the save state, the page link, history, discard
// and publish.
export function LandingEditor({
  lang,
  pageId,
  initial,
  product,
  variants,
  rates,
  storeTexts,
  theme,
  shopColor,
  pageUrl,
  backHref,
  forms,
  t,
}: {
  lang: string;
  pageId: string;
  initial: Initial;
  product: Product;
  variants: Variant[];
  rates: RateMap;
  storeTexts: Record<"ar" | "fr" | "en", StoreText>;
  theme: Theme;
  shopColor: string;
  pageUrl: string;
  backHref: string;
  forms: Forms;
  t: EditorText;
}) {
  const ed = t.landingPages.editor;
  const lp = t.landingPages;
  const [meta, setMeta] = useState({ title: initial.title, slug: initial.slug, language: initial.language, color: initial.color ?? "", status: initial.status });
  const [sections, setSections] = useState(initial.sections);
  const [formTemplateId, setFormTemplateId] = useState(initial.formTemplateId ?? "");
  // The last saved state ("discard changes" goes back to it)
  const [saved, setSaved] = useState({ meta, sections, formTemplateId });
  const form = forms.templates.find((x) => x.id === formTemplateId)?.form ?? forms.product;
  const [tab, setTab] = useState<"components" | "form" | "settings">("components");
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listVersions>> | null>(null);
  const historyDialog = useModal();
  const touch = () => {
    setDirty(true);
    setMessage(null);
  };

  const locale = interfaceLocale(meta.language);
  const storeText = storeTexts[locale];
  const color = /^#[0-9a-f]{6}$/i.test(meta.color) ? meta.color : shopColor;

  const update = (id: string, patch: Partial<LandingSection>) => {
    setSections((all) => all.map((s) => (s.id === id ? ({ ...s, ...patch } as LandingSection) : s)));
    touch();
  };
  const move = (i: number, by: number) => {
    setSections((all) => {
      const next = [...all];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item);
      return next;
    });
    touch();
  };
  const remove = (id: string) => {
    setSections((all) => all.filter((x) => x.id !== id));
    if (selected === id) setSelected(null);
    touch();
  };
  const add = (type: SectionType) => {
    const s = newSection(type, storeText);
    setSections((all) => [...all, s]);
    setSelected(s.id);
    touch();
  };

  const save = (status = meta.status) =>
    startTransition(async () => {
      const draft: LandingDraft = { ...meta, status, sections, formTemplateId: formTemplateId || null };
      const r: ActionState = await saveLandingPage(lang, pageId, draft).catch(() => ({ ok: false, error: "unexpected" }));
      const e = t.errors as Record<string, string>;
      if (r.ok) {
        const next = { ...meta, status };
        setMeta(next);
        setSaved({ meta: next, sections, formTemplateId });
        setDirty(false);
        setMessage({ ok: true, text: t.common.saved });
      } else setMessage({ ok: false, text: e[r.error ?? "unexpected"] ?? e.unexpected });
    });
  const discard = () => {
    if (!confirm(ed.confirmDiscard)) return;
    setMeta(saved.meta);
    setSections(saved.sections);
    setFormTemplateId(saved.formTemplateId);
    setSelected(null);
    setDirty(false);
    setMessage(null);
  };
  const openHistory = () => {
    setHistory(null);
    historyDialog.current?.showModal();
    startTransition(async () => setHistory(await listVersions(lang, pageId)));
  };
  const restore = (versionId: string) =>
    startTransition(async () => {
      const v = await getVersion(lang, pageId, versionId);
      if (!v) return;
      setSections(v.sections);
      setMeta((m) => ({ ...m, title: v.title }));
      setFormTemplateId(v.formTemplateId ?? "");
      setSelected(null);
      historyDialog.current?.close();
      setDirty(true);
      setMessage({ ok: true, text: ed.restored });
    });

  const hasForm = sections.some((s) => s.type === "form");
  const current = sections.find((s) => s.id === selected) ?? null;
  const currentIndex = current ? sections.indexOf(current) : -1;
  const has = (type: SectionType) => sections.some((s) => s.type === type && !s.hidden);
  const suggestions = (["reviews", "countdown", "badges", "faq"] as const).filter((type) => !has(type));
  const palette = sectionTypes.filter((type) => type !== "poster" && (type !== "form" || !hasForm));

  return (
    <div className="space-y-4" data-testid="landing-builder">
      {/* Top bar: back, title, save state, page link, history, discard, publish, save */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href={backHref} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-fg">
          <ArrowRight size={16} className="ltr:rotate-180" /> {t.common.back}
        </Link>
        <h1 className="me-auto truncate text-xl font-bold">{meta.title}</h1>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${dirty ? "text-warning" : "text-accent"}`} data-testid="save-state" data-dirty={dirty}>
          {dirty ? ed.unsaved : <><Check size={13} /> {ed.saved}</>}
        </span>
        <Badge tone={meta.status === "published" ? "accent" : "neutral"}>{lp.statuses[meta.status]}</Badge>
        {meta.status === "published" && (
          <a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-fg">
            <ExternalLink size={15} /> {ed.open}
          </a>
        )}
        <Button variant="ghost" disabled={pending} onClick={openHistory} data-testid="open-history">
          <History size={15} /> {ed.history}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={discard} data-testid="discard-changes">
            <Undo2 size={15} /> {ed.discard}
          </Button>
        )}
        <Button variant="secondary" disabled={pending} onClick={() => save(meta.status === "published" ? "draft" : "published")} data-testid="toggle-publish">
          {meta.status === "published" ? ed.unpublish : ed.publish}
        </Button>
        <Button disabled={pending} onClick={() => save()} data-testid="save-page">
          {t.common.save}
        </Button>
      </div>
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}

      <dialog ref={historyDialog} className="m-auto w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40" data-testid="history-dialog">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-bold">{ed.historyTitle}</h2>
          <button type="button" aria-label={lp.close} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" onClick={() => historyDialog.current?.close()}>
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
                <li key={v.id} className="flex items-center gap-3 p-3 text-sm" data-version={v.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{v.title}</span>
                    <span className="block text-xs text-muted">
                      {new Date(v.at).toLocaleString(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-DZ" : "en-GB", { timeZone: "Africa/Algiers", dateStyle: "medium", timeStyle: "short" })}
                      {v.by ? ` · ${v.by}` : ""} · {fmt(ed.historySections, { n: v.count })}
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

      <div className="grid items-start gap-5 xl:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        {/* Left: components, form, page settings */}
        <div className="space-y-4">
          <nav className="flex gap-1 rounded-lg bg-panel p-1 text-sm">
            {(["components", "form", "settings"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-md px-2 py-1.5 font-medium ${tab === k ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`} data-builder-tab={k}>
                {k === "components" ? ed.components : ed[k]}
              </button>
            ))}
          </nav>

          {tab === "components" && (
            <>
              <Card className="space-y-2 p-3" data-testid="components">
                <p className="text-xs text-muted">{ed.componentsHint}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {palette.map((type) => (
                    <button key={type} type="button" onClick={() => add(type)} className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2 py-2 text-start text-xs font-semibold hover:border-accent/40 hover:bg-accent-soft" data-add={type}>
                      <Plus size={13} className="shrink-0 text-accent" /> <span className="truncate">{ed.types[type]}</span>
                    </button>
                  ))}
                </div>
              </Card>
              <Card className="space-y-2 p-3" data-testid="sections-editor">
                <p className="text-xs font-semibold text-muted">{ed.layers}</p>
                {sections.map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-0.5 rounded-lg border ${selected === s.id ? "border-accent bg-accent-soft/50" : "border-line"} ${s.hidden ? "opacity-60" : ""}`} data-editor-section={s.type}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-start" onClick={() => setSelected(selected === s.id ? null : s.id)} aria-expanded={selected === s.id}>
                      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-panel-2 text-[10px] font-bold text-muted tabular-nums">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{ed.types[s.type]}</span>
                        {summary(s) && <span className="block truncate text-[11px] text-muted">{summary(s)}</span>}
                      </span>
                    </button>
                    <button type="button" title={s.hidden ? ed.show : ed.hide} aria-label={s.hidden ? ed.show : ed.hide} className="rounded p-1 text-muted hover:text-fg" onClick={() => update(s.id, { hidden: !s.hidden })}>
                      {s.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button type="button" title={ed.remove} aria-label={ed.remove} className="rounded p-1 text-muted hover:text-danger" onClick={() => remove(s.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </Card>
              <Card className="space-y-2 p-3" data-testid="suggestions">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <Lightbulb size={14} className="text-warning" /> {ed.suggestions} {suggestions.length > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-warning">{suggestions.length}</span>}
                </p>
                {suggestions.length === 0 ? (
                  <p className="text-xs text-muted">{ed.noSuggestions}</p>
                ) : (
                  suggestions.map((type) => (
                    <div key={type} className="space-y-1 rounded-lg bg-panel-2 p-2" data-suggest={type}>
                      <p className="text-xs font-semibold">{ed.suggest[type][0]}</p>
                      <p className="text-[11px] text-muted">{ed.suggest[type][1]}</p>
                      <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => add(type)}>
                        + {ed.add}
                      </button>
                    </div>
                  ))
                )}
              </Card>
            </>
          )}

          {/* One form system: the page picks a form made in Store design → Order form (no separate copy here) */}
          {tab === "form" && (
            <Card className="space-y-3" data-testid="landing-form-choice">
              <Field label={ed.formChoice} hint={ed.formChoiceHint}>
                <Select
                  value={formTemplateId}
                  onChange={(e) => {
                    setFormTemplateId(e.target.value);
                    touch();
                  }}
                  data-testid="landing-form-template"
                >
                  <option value="">{ed.productForm}</option>
                  {forms.templates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Link href={formTemplateId ? `${forms.editHref}?template=${formTemplateId}` : forms.editHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                <ExternalLink size={14} /> {ed.editForm}
              </Link>
            </Card>
          )}

          {tab === "settings" && (
            <Card className="space-y-3">
              <Field label={ed.pageTitle}>
                <Input
                  value={meta.title}
                  maxLength={200}
                  onChange={(e) => {
                    setMeta((m) => ({ ...m, title: e.target.value }));
                    touch();
                  }}
                  aria-label={ed.pageTitle}
                />
              </Field>
              <Field label={ed.slug}>
                <Input
                  dir="ltr"
                  value={meta.slug}
                  maxLength={120}
                  onChange={(e) => {
                    setMeta((m) => ({ ...m, slug: e.target.value }));
                    touch();
                  }}
                  aria-label={ed.slug}
                />
              </Field>
              <Field label={lp.language}>
                <Select
                  value={meta.language}
                  onChange={(e) => {
                    setMeta((m) => ({ ...m, language: e.target.value as PageLanguage }));
                    touch();
                  }}
                  aria-label={lp.language}
                >
                  {pageLanguages.map((l) => (
                    <option key={l} value={l}>
                      {lp.languages[l]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={ed.color}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!meta.color}
                      onChange={(e) => {
                        setMeta((m) => ({ ...m, color: e.target.checked ? "" : shopColor }));
                        touch();
                      }}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    {ed.useStoreColor}
                  </label>
                  {meta.color && (
                    <input
                      type="color"
                      aria-label={ed.color}
                      value={color}
                      onChange={(e) => {
                        setMeta((m) => ({ ...m, color: e.target.value }));
                        touch();
                      }}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-bg p-1"
                    />
                  )}
                </div>
              </Field>
            </Card>
          )}
        </div>

        {/* Middle: the live page (real blocks and form); a click selects a block */}
        <div className="space-y-2 xl:sticky xl:top-20 xl:self-start">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">{ed.previewNote}</p>
            <div className="flex gap-1">
              {(["mobile", "desktop"] as const).map((d) => (
                <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`rounded-lg p-1.5 ${device === d ? "bg-panel-2 text-fg" : "text-muted"}`} aria-label={d}>
                  {d === "mobile" ? <Smartphone size={16} /> : <Monitor size={16} />}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-panel-2 p-3">
            <div
              className={`mx-auto max-h-[80vh] overflow-y-auto rounded-lg bg-white shadow-xl ${device === "mobile" ? "max-w-[390px]" : ""}`}
              data-testid="landing-preview"
              onMouseDownCapture={(e) => e.preventDefault()}
              onClickCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = (e.target as HTMLElement).closest<HTMLElement>("[data-sid]")?.dataset.sid;
                if (id) setSelected(id);
              }}
            >
              <div className="select-none">
                <StoreFrame locale={locale} color={color} theme={theme}>
                  <div lang={locale} dir={dir(locale)} className={isImagePage(sections) ? "" : "p-4"}>
                    <LandingSections
                      editing
                      selected={selected}
                      sections={sanitizeSections(sections)}
                      t={storeText}
                      price={<PriceTag price={product.price} compareAtPrice={product.compareAtPrice} currency={currencyLabel(locale)} />}
                      form={
                        <CheckoutForm
                          t={storeText}
                          currency={currencyLabel(locale)}
                          product={product}
                          variants={variants}
                          rates={rates}
                          wilayas={[]}
                          action={async () => ({ ok: false })}
                          saveLead={async () => {}}
                          settings={form}
                          embedded
                        />
                      }
                    />
                  </div>
                </StoreFrame>
              </div>
            </div>
          </div>
        </div>

        {/* Right: the selected block's settings */}
        <Card className="space-y-4 xl:sticky xl:top-20" data-testid="section-panel" data-selected={current?.type ?? ""}>
          <h2 className="text-sm font-semibold">{ed.panel}</h2>
          {!current ? (
            <p className="text-sm text-muted">{ed.selectHint}</p>
          ) : (
            <>
              <div className="flex items-center gap-1 border-b border-line pb-3">
                <span className="me-auto text-sm font-bold">{ed.types[current.type]}</span>
                <button type="button" title={ed.moveUp} aria-label={ed.moveUp} disabled={currentIndex === 0} className="rounded p-1.5 text-muted hover:text-fg disabled:opacity-30" onClick={() => move(currentIndex, -1)}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" title={ed.moveDown} aria-label={ed.moveDown} disabled={currentIndex === sections.length - 1} className="rounded p-1.5 text-muted hover:text-fg disabled:opacity-30" onClick={() => move(currentIndex, 1)}>
                  <ArrowDown size={15} />
                </button>
                <button type="button" title={current.hidden ? ed.show : ed.hide} aria-label={current.hidden ? ed.show : ed.hide} className="rounded p-1.5 text-muted hover:text-fg" onClick={() => update(current.id, { hidden: !current.hidden })}>
                  {current.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button type="button" title={ed.remove} aria-label={ed.remove} className="rounded p-1.5 text-muted hover:text-danger" onClick={() => remove(current.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
              <SectionFields key={current.id} lang={lang} pageId={pageId} section={current} set={(patch) => update(current.id, patch)} productImages={product.images} t={t} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
