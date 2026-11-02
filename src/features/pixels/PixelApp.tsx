"use client";

import { useState, useTransition } from "react";
import { ChevronDown, KeyRound, Plus, Save, Send, Server, SlidersHorizontal, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import { purchaseTriggers, type PixelPlatform, type PurchaseTrigger } from "@/lib/enums";
import { Alert, Button, Card, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { multiAccount, serverPlatforms } from "./ids";
import { savePlatformPixels, sendTestEvent } from "./actions";
import { PlatformMark } from "./PlatformMark";
import type { PixelRow } from "./queries";

type Text = Pick<Dictionary, "pixels" | "errors" | "common">;
type Product = { id: string; name: string };
type Entry = { key: string; id: string | null; name: string; tagId: string; secret: string; hasSecret: boolean; clearSecret: boolean; testCode: string; purchaseOn: PurchaseTrigger; productIds: string[] | null; active: boolean };

const blank = (): Entry => ({ key: crypto.randomUUID(), id: null, name: "", tagId: "", secret: "", hasSecret: false, clearSecret: false, testCode: "", purchaseOn: "placed", productIds: null, active: true });
const fromRows = (rows: PixelRow[]): Entry[] =>
  rows.map((p) => ({ key: p.id, id: p.id, name: p.name === p.tagId ? "" : p.name, tagId: p.tagId, secret: "", hasSecret: p.hasSecret, clearSecret: false, testCode: p.testCode ?? "", purchaseOn: p.purchaseOn, productIds: p.productIds, active: p.active }));
const placeholders: Record<PixelPlatform, string> = { meta: "123456789012345", tiktok: "C1A2B3C4D5E6F7G8H9I0", snapchat: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", ga4: "G-XXXXXXX", gtm: "GTM-XXXXXXX" };

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "start-[1.375rem]" : "start-0.5"}`} />
    </button>
  );
}

function TestButton({ lang, id, t }: { lang: string; id: string; t: Text }) {
  const px = t.pixels;
  const e = t.errors as Record<string, string>;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="py-1.5 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendTestEvent(lang, id).catch((): ActionState => ({ ok: false, error: "unexpected" }));
            setResult(r.ok ? { ok: true, text: fmt(px.testOk, { detail: r.message ?? "" }) } : { ok: false, text: `${e[r.error ?? "unexpected"] ?? e.unexpected}${r.message ? `: ${r.message}` : ""}` });
          })
        }
      >
        <Send size={14} /> {pending ? t.common.loading : px.test}
      </Button>
      {result && <Alert variant={result.ok ? "success" : "error"}>{result.text}</Alert>}
    </div>
  );
}

// Zimam's app page form: Google's single ID, or the ad platforms' list of ad accounts ("Add another ad account"),
// all saved together. Each account: pixel ID, server token (optional, encrypted), test code, and advanced options
// (when the purchase counts, which products).
export function PixelApp({ lang, platform, pixels, products, t }: { lang: string; platform: PixelPlatform; pixels: PixelRow[]; products: Product[]; t: Text }) {
  const px = t.pixels;
  const e = t.errors as Record<string, string>;
  const multi = multiAccount(platform);
  const hasServer = serverPlatforms.includes(platform);
  const withTestCode = platform === "meta" || platform === "tiktok";
  const { state, pending, onSubmit } = useActionForm(savePlatformPixels.bind(null, lang, platform));
  const initial = () => (pixels.length || multi ? fromRows(pixels) : [blank()]);
  const [entries, setEntries] = useState<Entry[]>(initial);
  // After a save the page sends the rows back (with their ids): start again from them
  const [source, setSource] = useState(pixels);
  if (source !== pixels) {
    setSource(pixels);
    setEntries(initial());
  }
  const update = (key: string, patch: Partial<Entry>) => setEntries((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const payload = JSON.stringify(entries.map(({ key: _k, hasSecret: _h, ...rest }) => rest));
  const err = (f: string, i: number) => fieldError(state, e, `${f}.${i}`);
  const saveLabel = platform === "gtm" ? px.save.gtm : platform === "ga4" ? px.save.ga4 : px.save.pixel;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" data-testid="pixel-form">
      <input type="hidden" name="accounts" value={payload} />
      <FormMessage state={state} errors={e} success={px.saved} />
      {entries.map((a, i) => {
        const saved = pixels.find((p) => p.id === a.id);
        return (
          <Card key={a.key} className="space-y-5 p-6" data-account={i} data-pixel={saved?.tagId}>
            {multi && (
              <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-panel-2">
                  <PlatformMark platform={platform} size={18} />
                </span>
                <div className="me-auto min-w-0">
                  <p className="font-semibold">{fmt(px.account, { n: i + 1 })}</p>
                  {saved && (
                    <p className="text-xs text-muted">
                      <bdi dir="ltr">{saved.tagId}</bdi>
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <span className={a.active ? "text-accent-ink" : "text-muted"}>{a.active ? px.running : px.stopped}</span>
                  <Switch on={a.active} onChange={(v) => update(a.key, { active: v })} label={px.running} />
                </label>
                <button type="button" onClick={() => setEntries((list) => list.filter((x) => x.key !== a.key))} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:border-danger/40 hover:text-danger" title={px.remove} aria-label={px.remove} data-testid="pixel-remove">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <div className={multi ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
              <Field label={px.tagLabels[platform]} htmlFor={`px-tag-${i}`} hint={px.tagHints[platform]} error={err("tagId", i)}>
                <div className="relative" dir="ltr">
                  <Input id={`px-tag-${i}`} dir="ltr" maxLength={60} value={a.tagId} onChange={(ev) => update(a.key, { tagId: ev.target.value })} placeholder={placeholders[platform]} className="pe-10" />
                  <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center opacity-70">
                    <PlatformMark platform={platform} size={16} />
                  </span>
                </div>
              </Field>
              {multi && (
                <Field label={px.name} htmlFor={`px-name-${i}`}>
                  <Input id={`px-name-${i}`} maxLength={80} value={a.name} onChange={(ev) => update(a.key, { name: ev.target.value })} placeholder={px.namePlaceholder} />
                </Field>
              )}
            </div>

            {hasServer && (
              <div className={multi ? "space-y-4 rounded-xl border border-line bg-panel-2/50 p-4" : "space-y-4"}>
                {multi && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Server size={15} className="text-accent" /> {px.serverTitle}
                    </h3>
                    <p className="mt-1 text-xs text-muted">{px.serverHint}</p>
                  </div>
                )}
                <div className={withTestCode ? "grid gap-4 sm:grid-cols-2" : ""}>
                  <Field label={px.secretLabels[platform]} htmlFor={`px-secret-${i}`} hint={a.hasSecret ? px.secretSaved : px.secretHints[platform]}>
                    <div className="relative" dir="ltr">
                      <Input id={`px-secret-${i}`} type="password" dir="ltr" autoComplete="off" maxLength={500} value={a.secret} onChange={(ev) => update(a.key, { secret: ev.target.value })} placeholder={a.hasSecret ? "••••••••" : px.secretPlaceholder} className="pe-10" />
                      <KeyRound size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
                    </div>
                  </Field>
                  {withTestCode && (
                    <Field label={px.testCode} htmlFor={`px-test-${i}`} hint={px.testCodeHint}>
                      <Input id={`px-test-${i}`} dir="ltr" maxLength={40} value={a.testCode} onChange={(ev) => update(a.key, { testCode: ev.target.value })} placeholder="TEST12345" />
                    </Field>
                  )}
                </div>
                {a.hasSecret && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={a.clearSecret} onChange={(ev) => update(a.key, { clearSecret: ev.target.checked })} className="size-4 accent-[var(--color-accent)]" /> {px.clearSecret}
                  </label>
                )}
              </div>
            )}

            <details className="group rounded-xl border border-line" open={Boolean(err("productIds", i))}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal size={15} className="text-muted" /> {px.advanced}
                <span className="ms-auto text-xs font-normal text-muted">
                  {px.purchaseOptions[a.purchaseOn]} · {a.productIds ? fmt(px.productsCount, { n: a.productIds.length }) : px.scopes.all}
                </span>
                <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={px.purchaseOn} htmlFor={`px-purchase-${i}`} hint={px.purchaseHint}>
                    <Select id={`px-purchase-${i}`} value={a.purchaseOn} onChange={(ev) => update(a.key, { purchaseOn: ev.target.value as PurchaseTrigger })}>
                      {purchaseTriggers.map((p) => (
                        <option key={p} value={p}>
                          {px.purchaseOptions[p]}
                        </option>
                      ))}
                    </Select>
                    {a.purchaseOn !== "placed" && (!hasServer || (!a.hasSecret && !a.secret) || a.clearSecret) && <p className="mt-1.5 text-xs text-warning">{px.purchaseNeedsSecret}</p>}
                  </Field>
                  <Field label={px.scope} htmlFor={`px-scope-${i}`} hint={px.scopeHint} error={err("productIds", i)}>
                    <Select id={`px-scope-${i}`} value={a.productIds ? "products" : "all"} onChange={(ev) => update(a.key, { productIds: ev.target.value === "products" ? [] : null })}>
                      <option value="all">{px.scopes.all}</option>
                      <option value="products">{px.scopes.products}</option>
                    </Select>
                  </Field>
                </div>
                {a.productIds &&
                  (products.length ? (
                    <div className="grid max-h-52 gap-1.5 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2" data-testid="pixel-products">
                      {products.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={a.productIds!.includes(p.id)}
                            onChange={(ev) => update(a.key, { productIds: ev.target.checked ? [...a.productIds!, p.id] : a.productIds!.filter((x) => x !== p.id) })}
                            className="size-4 accent-[var(--color-accent)]"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">{px.noProducts}</p>
                  ))}
              </div>
            </details>

            {saved?.hasSecret && <TestButton lang={lang} id={saved.id} t={t} />}
          </Card>
        );
      })}

      {multi && (
        <Card className="space-y-1.5 p-5">
          <button type="button" onClick={() => setEntries((list) => [...list, blank()])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline" data-testid="pixel-add" disabled={entries.length >= 10}>
            <Plus size={16} /> {entries.length ? px.addAnother : px.addFirst}
          </button>
          <p className="text-xs text-muted">{px.accountsHint}</p>
        </Card>
      )}

      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText={t.common.loading} className="h-12 px-6" data-testid="pixel-save">
          <Save size={17} /> {saveLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
