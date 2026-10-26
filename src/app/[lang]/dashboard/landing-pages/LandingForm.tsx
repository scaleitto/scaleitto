"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { LandingSection } from "@/db/schema";
import { sectionTypes } from "@/lib/landing";

type SectionType = LandingSection["type"];
// Editable form of a section: list sections are kept as raw text lines while typing.
type Draft = { type: SectionType; title: string; subtitle: string; image: string; body: string; lines: string };

const isUrl = (s: string) => /^https?:\/\//.test(s.trim());
const splitPair = (line: string) => {
  const [a, ...rest] = line.split("|");
  return [a.trim(), rest.join("|").trim()] as const;
};
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

function toDraft(s: LandingSection): Draft {
  const d: Draft = { type: s.type, title: "", subtitle: "", image: "", body: "", lines: "" };
  switch (s.type) {
    case "hero":
      return { ...d, title: s.title, subtitle: s.subtitle ?? "", image: s.image ?? "" };
    case "text":
      return { ...d, title: s.title ?? "", body: s.body };
    case "image":
      return { ...d, image: s.url };
    case "features":
      return { ...d, title: s.title ?? "", lines: s.items.join("\n") };
    case "testimonials":
      return { ...d, title: s.title ?? "", lines: s.items.map((i) => `${i.name} | ${i.text}`).join("\n") };
    case "faq":
      return { ...d, title: s.title ?? "", lines: s.items.map((i) => `${i.q} | ${i.a}`).join("\n") };
  }
}

// Incomplete sections are dropped instead of failing the save.
function fromDraft(d: Draft): LandingSection | null {
  const title = d.title.trim() || undefined;
  switch (d.type) {
    case "hero":
      return title ? { type: "hero", title, subtitle: d.subtitle.trim() || undefined, image: isUrl(d.image) ? d.image.trim() : undefined } : null;
    case "text":
      return d.body.trim() ? { type: "text", title, body: d.body.trim() } : null;
    case "image":
      return isUrl(d.image) ? { type: "image", url: d.image.trim() } : null;
    case "features": {
      const items = lines(d.lines);
      return items.length ? { type: "features", title, items } : null;
    }
    case "testimonials": {
      const items = lines(d.lines).map(splitPair).filter(([a, b]) => a && b).map(([name, text]) => ({ name, text }));
      return items.length ? { type: "testimonials", title, items } : null;
    }
    case "faq": {
      const items = lines(d.lines).map(splitPair).filter(([a, b]) => a && b).map(([q, a]) => ({ q, a }));
      return items.length ? { type: "faq", title, items } : null;
    }
  }
}

export type LandingFormValues = { title: string; productId: string; status: "active" | "draft"; sections: LandingSection[] };

export function LandingForm({
  t,
  action,
  products,
  initial,
}: {
  t: Dictionary;
  action: (formData: FormData) => void;
  products: { id: string; name: string; image: string | null }[];
  initial?: LandingFormValues;
}) {
  const l = t.landingPages;
  const [drafts, setDrafts] = useState<Draft[]>(
    () => initial?.sections.map(toDraft) ?? [{ type: "hero", title: "", subtitle: "", image: products[0]?.image ?? "", body: "", lines: "" }],
  );
  const [newType, setNewType] = useState<SectionType>("features");

  const update = (i: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= drafts.length) return;
    const next = [...drafts];
    [next[i], next[j]] = [next[j], next[i]];
    setDrafts(next);
  };
  const sections = drafts.map(fromDraft).filter((s): s is LandingSection => s !== null);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />
      <div className="card grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="label" htmlFor="title">{l.pageTitle}</label>
          <input className="input" id="title" name="title" required defaultValue={initial?.title} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="productId">{l.product}</label>
          <select className="input" id="productId" name="productId" required defaultValue={initial?.productId}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">{t.products.status}</label>
          <select className="input" id="status" name="status" defaultValue={initial?.status ?? "active"}>
            <option value="active">{t.products.active}</option>
            <option value="draft">{t.products.draft}</option>
          </select>
        </div>
      </div>

      <h2 className="text-lg font-bold">{l.sections}</h2>
      {drafts.map((d, i) => (
        <div key={i} className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="badge bg-slate-100 text-slate-700">{l.types[d.type]}</span>
            <div className="flex gap-1">
              <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={() => move(i, -1)} disabled={i === 0}>↑ {l.moveUp}</button>
              <button type="button" className="btn-outline px-2 py-1 text-xs" onClick={() => move(i, 1)} disabled={i === drafts.length - 1}>↓ {l.moveDown}</button>
              <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>{t.common.delete}</button>
            </div>
          </div>
          {d.type !== "image" && (
            <input className="input" placeholder={l.fields.title} value={d.title} onChange={(e) => update(i, { title: e.target.value })} />
          )}
          {d.type === "hero" && (
            <input className="input" placeholder={l.fields.subtitle} value={d.subtitle} onChange={(e) => update(i, { subtitle: e.target.value })} />
          )}
          {(d.type === "hero" || d.type === "image") && (
            <input className="input font-mono text-xs" dir="ltr" placeholder={`${l.fields.image} https://...`} value={d.image} onChange={(e) => update(i, { image: e.target.value })} />
          )}
          {d.type === "text" && (
            <textarea className="input min-h-28" placeholder={l.fields.body} value={d.body} onChange={(e) => update(i, { body: e.target.value })} />
          )}
          {(d.type === "features" || d.type === "testimonials" || d.type === "faq") && (
            <textarea
              className="input min-h-28"
              placeholder={d.type === "features" ? l.fields.items : d.type === "testimonials" ? l.fields.testimonials : l.fields.faq}
              value={d.lines}
              onChange={(e) => update(i, { lines: e.target.value })}
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-48" value={newType} onChange={(e) => setNewType(e.target.value as SectionType)}>
          {sectionTypes.map((type) => (
            <option key={type} value={type}>{l.types[type]}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn-outline"
          onClick={() => setDrafts([...drafts, { type: newType, title: "", subtitle: "", image: "", body: "", lines: "" }])}
        >
          + {l.addSection}
        </button>
      </div>

      <button className="btn">{t.common.save}</button>
    </form>
  );
}
