"use client";

import { useState, useTransition } from "react";
import { ArrowUp, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Button, Card, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { SwitchRow } from "@/ui/Switch";
import type { AgentRule, DeliveryRule } from "./rules";
import { changeRule, saveRule } from "./settings-actions";

type Text = Pick<Dictionary, "apps" | "errors" | "common">;
type Option = { id: string; name: string };
type Kind = "delivery" | "agent";

function WilayaPicker({ wilayas, value, onChange, t }: { wilayas: { code: number; name: string }[]; value: number[]; onChange: (v: number[]) => void; t: Text }) {
  const r = t.apps.rules;
  const [q, setQ] = useState("");
  const shown = wilayas.filter((w) => w.name.toLowerCase().includes(q.trim().toLowerCase()) || String(w.code) === q.trim());
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="me-auto text-sm font-semibold">{r.wilayas}</p>
        <span className="text-xs text-muted">{value.length ? fmt(r.wilayasCount, { n: value.length }) : r.allWilayas}</span>
        <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={r.searchWilaya} className="h-9 w-40" aria-label={r.searchWilaya} />
        {value.length > 0 && (
          <Button type="button" variant="ghost" className="py-1 text-xs" onClick={() => onChange([])}>
            {r.clear}
          </Button>
        )}
      </div>
      <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-3" data-testid="rule-wilayas">
        {shown.map((w) => (
          <label key={w.code} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-panel-2">
            <input type="checkbox" name="wilayas" value={w.code} checked={value.includes(w.code)} onChange={(ev) => onChange(ev.target.checked ? [...value, w.code] : value.filter((x) => x !== w.code))} className="size-4 accent-[var(--color-accent)]" />
            <span className="truncate">{w.name}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{r.wilayasHint}</p>
    </div>
  );
}

function RuleForm({ lang, kind, rule, accounts, agents, products, wilayas, onDone, t }: { lang: string; kind: Kind; rule: DeliveryRule | AgentRule | null; accounts: Option[]; agents: Option[]; products: Option[]; wilayas: { code: number; name: string }[]; onDone: () => void; t: Text }) {
  const r = t.apps.rules;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(saveRule.bind(null, lang, kind, rule?.id ?? null));
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state.ok) onDone();
  }
  const [active, setActive] = useState(rule?.active ?? true);
  const [picked, setPicked] = useState<number[]>(rule?.wilayas ?? []);
  const d = kind === "delivery" ? (rule as DeliveryRule | null) : null;
  const a = kind === "agent" ? (rule as AgentRule | null) : null;
  const [chosen, setChosen] = useState<string[]>(a?.productIds ?? []);
  const err = (f: string) => fieldError(state, e, f);
  return (
    <Card className="space-y-4 p-6" data-testid="rule-form">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="me-auto text-lg font-semibold">{rule ? r.edit : r.create}</h2>
          <button type="button" onClick={onDone} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-panel-2" aria-label={t.common.cancel}>
            <X size={17} />
          </button>
        </div>
        <FormMessage state={state} errors={e} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={r.name} htmlFor="rule-name" error={err("name")}>
            <Input id="rule-name" name="name" maxLength={80} defaultValue={rule?.name ?? ""} placeholder={kind === "delivery" ? r.namePlaceholderDelivery : r.namePlaceholderAgent} />
          </Field>
          {kind === "delivery" ? (
            <Field label={r.company} htmlFor="rule-company" error={err("carrierAccountId")} hint={accounts.length ? undefined : r.noCompanies}>
              <Select id="rule-company" name="carrierAccountId" defaultValue={d?.carrierAccountId ?? ""}>
                <option value="">—</option>
                {accounts.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label={r.agent} htmlFor="rule-agent" error={err("agentId")} hint={agents.length ? undefined : r.noAgents}>
              <Select id="rule-agent" name="agentId" defaultValue={a?.agentId ?? ""}>
                <option value="">—</option>
                {agents.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {kind === "delivery" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={r.minTotal} htmlFor="rule-min" error={err("minTotal")}>
              <Input id="rule-min" name="minTotal" inputMode="numeric" dir="ltr" defaultValue={d?.minTotal ?? ""} placeholder="0" />
            </Field>
            <Field label={r.maxTotal} htmlFor="rule-max" error={err("maxTotal")}>
              <Input id="rule-max" name="maxTotal" inputMode="numeric" dir="ltr" defaultValue={d?.maxTotal ?? ""} placeholder="∞" />
            </Field>
            <Field label={r.deliveryType} htmlFor="rule-type">
              <Select id="rule-type" name="deliveryType" defaultValue={d?.deliveryType ?? "any"}>
                <option value="any">{r.types.any}</option>
                <option value="home">{r.types.home}</option>
                <option value="office">{r.types.office}</option>
              </Select>
            </Field>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={r.source} htmlFor="rule-source">
                <Select id="rule-source" name="source" defaultValue={a?.source ?? "any"}>
                  <option value="any">{r.sources.any}</option>
                  <option value="store">{r.sources.store}</option>
                  <option value="landing">{r.sources.landing}</option>
                  <option value="channel">{r.sources.channel}</option>
                </Select>
              </Field>
              <Field label={r.from} htmlFor="rule-from">
                <Input id="rule-from" name="from" type="time" dir="ltr" defaultValue={a?.from ?? ""} />
              </Field>
              <Field label={r.to} htmlFor="rule-to">
                <Input id="rule-to" name="to" type="time" dir="ltr" defaultValue={a?.to ?? ""} />
              </Field>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                {r.products} <span className="text-xs font-normal text-muted">{chosen.length ? fmt(r.productsCount, { n: chosen.length }) : r.allProducts}</span>
              </p>
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2" data-testid="rule-products">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-panel-2">
                    <input type="checkbox" name="productIds" value={p.id} checked={chosen.includes(p.id)} onChange={(ev) => setChosen(ev.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id))} className="size-4 accent-[var(--color-accent)]" />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        <WilayaPicker wilayas={wilayas} value={picked} onChange={setPicked} t={t} />
        <div className="rounded-xl border border-line p-4">
          <SwitchRow name="active" checked={active} onChange={setActive} label={r.active} />
        </div>
        <div className="flex justify-end">
          <SubmitButton pending={pending} pendingText={t.common.loading} data-testid="rule-save">
            <Save size={16} /> {r.save}
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}

// Zimam's rule lists (Delivery auto assign, Agent auto assign): "Create New Rule", the active rules in order (first match wins)
export function RulesApp({ lang, kind, rules, accounts = [], agents = [], products = [], wilayas, t }: { lang: string; kind: Kind; rules: (DeliveryRule | AgentRule)[]; accounts?: Option[]; agents?: Option[]; products?: Option[]; wilayas: { code: number; name: string }[]; t: Text }) {
  const r = t.apps.rules;
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const nameOf = (list: Option[], id: string) => list.find((x) => x.id === id)?.name ?? "—";
  const describe = (rule: DeliveryRule | AgentRule) => {
    const parts: string[] = [rule.wilayas.length ? fmt(r.wilayasCount, { n: rule.wilayas.length }) : r.allWilayas];
    if (kind === "delivery") {
      const d = rule as DeliveryRule;
      if (d.minTotal !== null || d.maxTotal !== null) parts.push(`${d.minTotal ?? 0} – ${d.maxTotal ?? "∞"} ${t.common.currency}`);
      if (d.deliveryType !== "any") parts.push(r.types[d.deliveryType]);
    } else {
      const a = rule as AgentRule;
      parts.push(a.productIds.length ? fmt(r.productsCount, { n: a.productIds.length }) : r.allProducts);
      if (a.source !== "any") parts.push(r.sources[a.source]);
      if (a.from || a.to) parts.push(`${a.from || "00:00"} → ${a.to || "24:00"}`);
    }
    return parts.join(" · ");
  };
  const run = (id: string, change: "delete" | "on" | "off" | "up") => start(async () => void (await changeRule(lang, kind, id, change)));
  return (
    <div className="space-y-5" data-testid={`rules-${kind}`}>
      {editing ? (
        <RuleForm key={editing} lang={lang} kind={kind} rule={rules.find((x) => x.id === editing) ?? null} accounts={accounts} agents={agents} products={products} wilayas={wilayas} onDone={() => setEditing(null)} t={t} />
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")} data-testid="rule-new">
            <Plus size={16} /> {r.create}
          </Button>
        </div>
      )}
      <Card className="p-0">
        <div className="border-b border-line p-5">
          <h2 className="text-lg font-semibold">{kind === "delivery" ? r.titleDelivery : r.titleAgent}</h2>
          <p className="text-xs text-muted">{r.orderHint}</p>
        </div>
        {rules.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">{kind === "delivery" ? r.emptyDelivery : r.emptyAgent}</p>
        ) : (
          <ol className="divide-y divide-line">
            {rules.map((rule, i) => (
              <li key={rule.id} className={`flex flex-wrap items-center gap-3 p-4 ${rule.active ? "" : "opacity-60"}`} data-rule={rule.name}>
                <span className="grid size-8 place-items-center rounded-full bg-panel-2 text-sm font-bold tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {rule.name} <span className="text-muted">→ {kind === "delivery" ? nameOf(accounts, (rule as DeliveryRule).carrierAccountId) : nameOf(agents, (rule as AgentRule).agentId)}</span>
                  </p>
                  <p className="text-xs text-muted">{describe(rule)}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rule.active} disabled={busy} onChange={(ev) => run(rule.id, ev.target.checked ? "on" : "off")} className="size-4 accent-[var(--color-accent)]" aria-label={r.active} />
                  {rule.active ? t.apps.grid.active : t.apps.grid.inactive}
                </label>
                {i > 0 && (
                  <button type="button" disabled={busy} onClick={() => run(rule.id, "up")} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg" title={r.up} aria-label={r.up}>
                    <ArrowUp size={15} />
                  </button>
                )}
                <button type="button" onClick={() => setEditing(rule.id)} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg" title={t.common.edit} aria-label={t.common.edit}>
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(r.confirmDelete)) run(rule.id, "delete");
                  }}
                  className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:border-danger/40 hover:text-danger"
                  title={t.common.delete}
                  aria-label={t.common.delete}
                  data-testid="rule-delete"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
