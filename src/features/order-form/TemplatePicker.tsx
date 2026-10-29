"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import { Alert, Button, Field, Input, Select } from "@/ui";
import type { FormSettings } from "@/features/landing/types";
import { createTemplate, deleteTemplate, updateTemplate } from "./actions";

export type TemplateInfo = { id: string; name: string; products: number };
export type ProductChoice = { id: string; name: string; templateId: string | null };
type Text = Pick<Dictionary, "orderForm" | "errors" | "common">;

// Which form is being edited: the store's form, or a template used by chosen products (WEBI "templates")
export function TemplatePicker({ lang, base, templates, current, products, form, dirty, t }: { lang: string; base: string; templates: TemplateInfo[]; current: string | null; products: ProductChoice[]; form: FormSettings; dirty: boolean; t: Text }) {
  const f = t.orderForm;
  const router = useRouter();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tpl = templates.find((x) => x.id === current) ?? null;
  const go = (id: string | null) => router.push(id ? `${base}?template=${id}` : base);
  const errors = t.errors as Record<string, string>;
  const result = (r: ActionState) => (r.ok ? null : (errors[r.error ?? "unexpected"] ?? errors.unexpected));

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-panel p-3" data-testid="template-picker">
      <Field label={f.templates.label} htmlFor="form-template">
        <Select
          id="form-template"
          value={current ?? ""}
          onChange={(e) => {
            if (dirty && !confirm(f.templates.leaveUnsaved)) return;
            go(e.target.value || null);
          }}
          className="min-w-56"
        >
          <option value="">{f.templates.store}</option>
          {templates.map((x) => (
            <option key={x.id} value={x.id}>
              {fmt(f.templates.option, { name: x.name, n: x.products })}
            </option>
          ))}
        </Select>
      </Field>
      <Button variant="secondary" onClick={() => setDialog("create")} data-testid="new-template">
        <Plus size={15} /> {f.templates.create}
      </Button>
      {tpl && (
        <>
          <Button variant="ghost" onClick={() => setDialog("edit")} data-testid="edit-template">
            <Pencil size={15} /> {fmt(f.templates.products, { n: tpl.products })}
          </Button>
          <Button
            variant="ghost"
            className="hover:text-danger"
            disabled={pending}
            onClick={() =>
              confirm(f.templates.deleteConfirm) &&
              startTransition(async () => {
                await deleteTemplate(lang, tpl.id);
                go(null);
              })
            }
            data-testid="delete-template"
          >
            <Trash2 size={15} /> {t.common.delete}
          </Button>
        </>
      )}
      <p className="basis-full text-xs text-muted">{tpl ? f.templates.hintTemplate : f.storeHint}</p>
      {error && <Alert>{error}</Alert>}
      {dialog && (
        <TemplateDialog
          title={dialog === "create" ? f.templates.create : tpl?.name ?? ""}
          initialName={dialog === "edit" ? (tpl?.name ?? "") : ""}
          initialProducts={dialog === "edit" && tpl ? products.filter((p) => p.templateId === tpl.id).map((p) => p.id) : []}
          products={products}
          templates={templates}
          editing={dialog === "edit" ? tpl?.id ?? null : null}
          pending={pending}
          onClose={() => setDialog(null)}
          onSave={(name, ids) =>
            startTransition(async () => {
              setError(null);
              const r = dialog === "create" ? await createTemplate(lang, name, ids, form) : await updateTemplate(lang, tpl!.id, name, ids);
              const problem = result(r);
              if (problem) return setError(problem);
              setDialog(null);
              if (dialog === "create" && r.message) go(r.message);
              else router.refresh();
            })
          }
          t={t}
        />
      )}
    </div>
  );
}

function TemplateDialog({
  title,
  initialName,
  initialProducts,
  products,
  templates,
  editing,
  pending,
  onClose,
  onSave,
  t,
}: {
  title: string;
  initialName: string;
  initialProducts: string[];
  products: ProductChoice[];
  templates: TemplateInfo[];
  editing: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: (name: string, productIds: string[]) => void;
  t: Text;
}) {
  const f = t.orderForm.templates;
  const [name, setName] = useState(initialName);
  const [chosen, setChosen] = useState<string[]>(initialProducts);
  const nameOf = (id: string | null) => templates.find((x) => x.id === id)?.name;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={t.common.cancel} onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col gap-4 rounded-2xl bg-panel p-5 shadow-2xl" data-testid="template-dialog">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <LayoutTemplate size={18} className="text-accent" /> {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.common.cancel} className="rounded-md p-1 text-muted hover:bg-panel-2">
            <X size={18} />
          </button>
        </div>
        <Field label={f.name} htmlFor="template-name">
          <Input id="template-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={f.namePlaceholder} autoFocus />
        </Field>
        <div className="min-h-0 space-y-2">
          <p className="text-sm font-medium">{f.assign}</p>
          <p className="text-xs text-muted">{f.assignHint}</p>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line" data-testid="template-products">
            {products.map((p) => {
              const other = p.templateId && p.templateId !== editing ? nameOf(p.templateId) : null;
              return (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-panel-2">
                    <input
                      type="checkbox"
                      checked={chosen.includes(p.id)}
                      onChange={(e) => setChosen((all) => (e.target.checked ? [...all, p.id] : all.filter((x) => x !== p.id)))}
                      className="size-4 accent-[var(--color-accent)]"
                      data-product={p.name}
                    />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {other && <span className="text-xs text-muted">{fmt(f.usesOther, { name: other })}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={pending || name.trim().length < 2} onClick={() => onSave(name, chosen)} data-testid="save-template">
            {pending ? t.common.loading : t.common.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
