"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Layers, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { SwitchRow } from "@/ui/Switch";
import type { CollectionTexts } from "@/server/db/schema";
import { deleteCollection, saveCollection } from "./actions";
import { textIn } from "./types";

type Text = Pick<Dictionary, "apps" | "errors" | "common" | "media">;
export type CollectionRow = { id: string; handle: string; titles: CollectionTexts; descriptions: CollectionTexts; parentId: string | null; image: string | null; active: boolean; products: number };

function CollectionForm({ lang, row, rows, onDone, t }: { lang: string; row: CollectionRow | null; rows: CollectionRow[]; onDone: () => void; t: Text }) {
  const c = t.apps.collections;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveCollection.bind(null, lang, row?.id ?? null));
  const [image, setImage] = useState<string[]>(row?.image ? [row.image] : []);
  const [active, setActive] = useState(row?.active ?? true);
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state.ok) onDone();
  }
  const err = (f: string) => fieldError(state, e, f);
  // A parent is a top-level collection other than this one; a collection with sub-collections stays on top
  const hasChildren = row ? rows.some((r) => r.parentId === row.id) : false;
  const parents = rows.filter((r) => !r.parentId && r.id !== row?.id);
  const langs = [
    ["Ar", "ar"],
    ["Fr", "fr"],
    ["En", "en"],
  ] as const;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="collection-form">
      <FormMessage state={state} errors={e} />
      <Field label={c.handle} htmlFor="col-handle" hint={c.handleHint} error={err("handle")}>
        <Input id="col-handle" name="handle" dir="ltr" maxLength={80} defaultValue={row?.handle ?? ""} placeholder="summer-sale" />
      </Field>
      {langs.map(([k, l]) => (
        <Field key={k} label={c.titles[l]} htmlFor={`col-title-${l}`} error={l === "ar" ? err("titleAr") : undefined}>
          <Input id={`col-title-${l}`} name={`title${k}`} maxLength={120} dir={l === "ar" ? "rtl" : "ltr"} defaultValue={row?.titles[l] ?? ""} />
        </Field>
      ))}
      {langs.map(([k, l]) => (
        <Field key={k} label={c.descriptions[l]} htmlFor={`col-desc-${l}`} hint={l === "ar" ? c.descriptionHint : undefined}>
          <Textarea id={`col-desc-${l}`} name={`description${k}`} rows={3} maxLength={1000} dir={l === "ar" ? "rtl" : "ltr"} defaultValue={row?.descriptions[l] ?? ""} />
        </Field>
      ))}
      <Field label={c.parent} htmlFor="col-parent" hint={hasChildren ? c.parentLocked : c.parentHint} error={err("parentId")}>
        <Select id="col-parent" name="parentId" defaultValue={row?.parentId ?? ""} disabled={hasChildren}>
          <option value="">{c.topLevel}</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {textIn(p.titles, lang)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">{c.image}</p>
        <ImageManager t={t.media} value={image} onChange={setImage} max={1} />
        <p className="text-xs text-muted">{c.imageHint}</p>
        <input type="hidden" name="image" value={image[0] ?? ""} />
      </div>
      <div className="rounded-xl border border-line p-4">
        <SwitchRow name="active" checked={active} onChange={setActive} label={c.active} testId="collection-active" />
      </div>
      <div className="flex justify-end gap-2">
        {row && (
          <Button type="button" variant="secondary" onClick={onDone}>
            {t.common.cancel}
          </Button>
        )}
        <SubmitButton pending={pending} pendingText={t.common.loading} data-testid="collection-save">
          <Save size={16} /> {c.save}
        </SubmitButton>
      </div>
    </form>
  );
}

// Zimam's Collections: the form (create, or edit the chosen one) beside the list
export function CollectionsApp({ lang, rows, storeUrl, t }: { lang: string; rows: CollectionRow[]; storeUrl: string; t: Text }) {
  const c = t.apps.collections;
  const [editing, setEditing] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [busy, start] = useTransition();
  const row = rows.find((r) => r.id === editing) ?? null;
  const done = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
  };
  const ordered = rows.filter((r) => !r.parentId).flatMap((top) => [top, ...rows.filter((r) => r.parentId === top.id)]);
  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <Card className="space-y-4 self-start p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{row ? c.edit : c.create}</h2>
          {row && (
            <Button variant="ghost" className="py-1 text-xs" onClick={done}>
              <Plus size={14} /> {c.new}
            </Button>
          )}
        </div>
        <CollectionForm key={`${editing ?? "new"}-${formKey}`} lang={lang} row={row} rows={rows} onDone={done} t={t} />
      </Card>
      <Card className="self-start p-0" data-testid="collection-list">
        <div className="border-b border-line p-5">
          <h2 className="text-lg font-semibold">{c.yours}</h2>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{fmt(c.count, { n: rows.length })}</p>
        </div>
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">{c.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {ordered.map((r) => (
              <li key={r.id} className={`flex items-center gap-3 p-4 ${r.parentId ? "ps-10" : ""}`} data-collection={r.handle}>
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" className="size-12 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-12 place-items-center rounded-lg bg-panel-2 text-muted">
                    <Layers size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{textIn(r.titles, lang)}</p>
                  <p className="text-xs text-muted">
                    <bdi dir="ltr">/collections/{r.handle}</bdi> · {fmt(c.products, { n: r.products })}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.active ? "bg-accent-soft text-accent-ink" : "bg-panel-2 text-muted"}`}>{r.active ? t.apps.grid.active : t.apps.grid.inactive}</span>
                <a href={`${storeUrl}/collections/${r.handle}`} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg" title={c.open} aria-label={c.open}>
                  <ExternalLink size={15} />
                </a>
                <button type="button" onClick={() => setEditing(r.id)} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg" title={t.common.edit} aria-label={t.common.edit} data-testid="collection-edit">
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(c.confirmDelete)) start(async () => void (await deleteCollection(lang, r.id)));
                  }}
                  className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:border-danger/40 hover:text-danger"
                  title={t.common.delete}
                  aria-label={t.common.delete}
                  data-testid="collection-delete"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
