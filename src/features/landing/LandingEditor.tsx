"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, Copy, ExternalLink, Eye, EyeOff, Monitor, Smartphone, Trash2 } from "lucide-react";
import { currencyLabel, type StoreText } from "@/i18n/store";
import type { RateMap } from "@/features/checkout/pricing";
import type { ActionState } from "@/lib/action";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/ui";
import { StoreFrame } from "@/features/storefront/blocks";
import { CheckoutForm } from "@/features/storefront/CheckoutForm";
import { findTheme } from "@/features/themes/themes";
import { dir } from "@/i18n/config";
import { LandingSections } from "./blocks";
import { PriceTag } from "./PriceTag";
import { FormEditor } from "./FormEditor";
import { SectionFields, type EditorText } from "./SectionFields";
import { saveLandingPage, type LandingDraft } from "./actions";
import { interfaceLocale, newSectionId, pageLanguages, resolveForm, sanitizeSections, sectionTypes, type FormSettings, type LandingSection, type PageLanguage, type SectionType } from "./types";

type Product = Parameters<typeof CheckoutForm>[0]["product"] & { name: string; compareAtPrice: number | null; images: string[] };
type Variant = Parameters<typeof CheckoutForm>[0]["variants"][number];
type Initial = { title: string; slug: string; language: PageLanguage; color: string | null; status: "draft" | "published"; sections: LandingSection[]; form: FormSettings };

function newSection(type: SectionType, t: StoreText): LandingSection {
  const id = newSectionId();
  switch (type) {
    case "hero":
      return { id, type, title: "" };
    case "badges":
      return { id, type, items: t.landing.defaults.badges };
    case "text":
      return { id, type, body: "" };
    case "imageText":
      return { id, type, title: "", body: "" };
    case "benefits":
      return { id, type, items: [{ icon: "✨", title: "", text: "" }] };
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
  }
}

// A one-line reminder of what a section contains, shown on its collapsed card.
function summary(s: LandingSection) {
  switch (s.type) {
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

export function LandingEditor({
  lang,
  pageId,
  initial,
  product,
  variants,
  rates,
  storeTexts,
  themeKey,
  shopColor,
  pageUrl,
  embedUrl,
  backHref,
  t,
}: {
  lang: string;
  pageId: string;
  initial: Initial;
  product: Product;
  variants: Variant[];
  rates: RateMap;
  storeTexts: Record<"ar" | "fr" | "en", StoreText>;
  themeKey: string;
  shopColor: string;
  pageUrl: string;
  embedUrl: string;
  backHref: string;
  t: EditorText;
}) {
  const ed = t.landingPages.editor;
  const lp = t.landingPages;
  const [meta, setMeta] = useState({ title: initial.title, slug: initial.slug, language: initial.language, color: initial.color ?? "", status: initial.status });
  const [sections, setSections] = useState(initial.sections);
  const [form, setForm] = useState(initial.form);
  const [tab, setTab] = useState<"sections" | "form" | "settings">("sections");
  const [open, setOpen] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
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

  const save = (status = meta.status) =>
    startTransition(async () => {
      const draft: LandingDraft = { ...meta, status, sections, form };
      const r: ActionState = await saveLandingPage(lang, pageId, draft).catch(() => ({ ok: false, error: "unexpected" }));
      const e = t.errors as Record<string, string>;
      if (r.ok) {
        setMeta((m) => ({ ...m, status }));
        setDirty(false);
        setMessage({ ok: true, text: t.common.saved });
      } else setMessage({ ok: false, text: e[r.error ?? "unexpected"] ?? e.unexpected });
    });

  const embedCode = `<iframe id="scaleitto-${pageId}" src="${embedUrl}" style="width:100%;border:0;min-height:760px" loading="lazy" title="${meta.title.replace(/"/g, "")}"></iframe>\n<script>window.addEventListener("message",function(e){if(e.data&&e.data.type==="scaleitto:height"&&e.data.id==="${pageId}"){document.getElementById("scaleitto-${pageId}").style.height=e.data.height+"px"}});</script>`;
  const hasForm = sections.some((s) => s.type === "form");

  return (
    <div className="space-y-4">
      {/* Top bar: back, title, status, save */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-fg">
          <ArrowRight size={16} className="ltr:rotate-180" /> {t.common.back}
        </Link>
        <h1 className="me-auto truncate text-xl font-bold">{meta.title}</h1>
        <Badge tone={meta.status === "published" ? "accent" : "neutral"}>{lp.statuses[meta.status]}</Badge>
        {dirty && <span className="text-xs text-warning">{ed.unsaved}</span>}
        {meta.status === "published" && (
          <a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-fg">
            <ExternalLink size={15} /> {ed.open}
          </a>
        )}
        <Button variant="secondary" disabled={pending} onClick={() => save(meta.status === "published" ? "draft" : "published")}>
          {meta.status === "published" ? ed.unpublish : ed.publish}
        </Button>
        <Button disabled={pending} onClick={() => save()} data-testid="save-page">
          {t.common.save}
        </Button>
      </div>
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <nav className="flex gap-1 rounded-lg bg-panel p-1 text-sm">
            {(["sections", "form", "settings"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${tab === k ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}>
                {ed[k]}
              </button>
            ))}
          </nav>

          {tab === "sections" && (
            <div className="space-y-2" data-testid="sections-editor">
              {sections.map((s, i) => (
                <div key={s.id} className={`rounded-xl border border-line bg-panel ${s.hidden ? "opacity-60" : ""}`} data-editor-section={s.type}>
                  <div className="flex items-center gap-1 p-2">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-panel-2" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                      <ChevronDown size={16} className={`shrink-0 text-muted transition ${open === s.id ? "rotate-180" : ""}`} />
                      <span className="shrink-0 text-sm font-semibold">{ed.types[s.type]}</span>
                      <span className="truncate text-xs text-muted">{summary(s)}</span>
                    </button>
                    <button type="button" title={ed.moveUp} aria-label={ed.moveUp} disabled={i === 0} className="rounded p-1.5 text-muted hover:text-fg disabled:opacity-30" onClick={() => move(i, -1)}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" title={ed.moveDown} aria-label={ed.moveDown} disabled={i === sections.length - 1} className="rounded p-1.5 text-muted hover:text-fg disabled:opacity-30" onClick={() => move(i, 1)}>
                      <ArrowDown size={15} />
                    </button>
                    <button type="button" title={s.hidden ? ed.show : ed.hide} aria-label={s.hidden ? ed.show : ed.hide} className="rounded p-1.5 text-muted hover:text-fg" onClick={() => update(s.id, { hidden: !s.hidden })}>
                      {s.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      title={ed.remove}
                      aria-label={ed.remove}
                      className="rounded p-1.5 text-muted hover:text-danger"
                      onClick={() => {
                        setSections((all) => all.filter((x) => x.id !== s.id));
                        touch();
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {open === s.id && (
                    <div className="border-t border-line p-4">
                      <SectionFields lang={lang} section={s} set={(patch) => update(s.id, patch)} productImages={product.images} t={t} />
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Select
                  aria-label={ed.addSection}
                  value=""
                  onChange={(e) => {
                    const type = e.target.value as SectionType;
                    if (!type) return;
                    const s = newSection(type, storeText);
                    setSections((all) => [...all, s]);
                    setOpen(s.id);
                    touch();
                  }}
                >
                  <option value="">+ {ed.addSection}</option>
                  {sectionTypes
                    .filter((type) => type !== "form" || !hasForm)
                    .map((type) => (
                      <option key={type} value={type}>
                        {ed.types[type]}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
          )}

          {tab === "form" && (
            <FormEditor
              form={form}
              set={(patch) => {
                setForm((f) => ({ ...f, ...patch }));
                touch();
              }}
              t={t}
              defaults={{ title: storeText.form.title, subtitle: storeText.form.subtitle, button: storeText.form.submit }}
            />
          )}

          {tab === "settings" && (
            <div className="space-y-4">
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
              <Card className="space-y-3">
                <h3 className="font-semibold">{ed.embed}</h3>
                <p className="text-xs text-muted">{ed.embedHint}</p>
                {meta.status !== "published" && <Alert variant="info">{ed.publishFirst}</Alert>}
                <textarea readOnly dir="ltr" rows={5} value={embedCode} className="w-full rounded-lg border border-line bg-bg p-2 font-mono text-xs text-muted" data-testid="embed-code" />
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard?.writeText(embedCode).catch(() => {});
                    setCopied(true);
                  }}
                >
                  <Copy size={15} /> {copied ? ed.copied : ed.copy}
                </Button>
              </Card>
            </div>
          )}
        </div>

        {/* Live preview with the real page blocks and form */}
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
            <div className={`mx-auto max-h-[80vh] overflow-y-auto rounded-lg bg-white shadow-xl ${device === "mobile" ? "max-w-[390px]" : ""}`} data-testid="landing-preview">
              <div inert className="select-none">
              <StoreFrame locale={locale} color={color} theme={findTheme(themeKey)}>
                <div lang={locale} dir={dir(locale)} className="p-4">
                  <LandingSections
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
                        settings={resolveForm(form)}
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
      </div>
    </div>
  );
}
