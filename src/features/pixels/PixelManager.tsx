"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Send, Server, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { ActionState } from "@/lib/action";
import { fmt } from "@/lib/format";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { pixelPlatforms, purchaseTriggers, type PixelPlatform } from "@/server/db/schema";
import { serverPlatforms } from "./ids";
import { deletePixel, savePixel, sendTestEvent, setPixelActive } from "./actions";
import type { PixelRow } from "./queries";

type Text = Pick<Dictionary, "pixels" | "errors" | "common">;
type Product = { id: string; name: string };

function PixelForm({ lang, pixel, products, onDone, t }: { lang: string; pixel: PixelRow | null; products: Product[]; onDone: () => void; t: Text }) {
  const px = t.pixels;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(savePixel.bind(null, lang, pixel?.id ?? null));
  const [platform, setPlatform] = useState<PixelPlatform>(pixel?.platform ?? "meta");
  const [scope, setScope] = useState(pixel?.productIds ? "products" : "all");
  const [purchaseOn, setPurchaseOn] = useState(pixel?.purchaseOn ?? "placed");
  const [secretTyped, setSecretTyped] = useState(false);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const hasServer = serverPlatforms.includes(platform);
  const err = (f: string) => fieldError(state, e, f);

  return (
    <Card className="space-y-4" data-testid="pixel-form">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormMessage state={state} errors={e} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={px.platform} htmlFor="px-platform">
            <Select id="px-platform" name="platform" value={platform} onChange={(ev) => setPlatform(ev.target.value as PixelPlatform)} disabled={Boolean(pixel)}>
              {pixelPlatforms.map((p) => (
                <option key={p} value={p}>
                  {px.platforms[p]}
                </option>
              ))}
            </Select>
            {/* a disabled select is not submitted */}
            {pixel && <input type="hidden" name="platform" value={platform} />}
          </Field>
          <Field label={px.name} htmlFor="px-name" error={err("name")}>
            <Input id="px-name" name="name" maxLength={80} defaultValue={pixel?.name ?? ""} placeholder={px.namePlaceholder} />
          </Field>
        </div>
        <Field label={px.tagLabels[platform]} htmlFor="px-tag" hint={px.tagHints[platform]} error={err("tagId")}>
          <Input id="px-tag" name="tagId" dir="ltr" maxLength={40} defaultValue={pixel?.tagId ?? ""} placeholder={platform === "ga4" ? "G-XXXXXXXXXX" : platform === "gtm" ? "GTM-XXXXXXX" : ""} />
        </Field>

        {hasServer && (
          <div className="space-y-4 rounded-lg border border-line p-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Server size={15} className="text-accent" /> {px.serverTitle}
              </h3>
              <p className="mt-1 text-xs text-muted">{px.serverHint}</p>
            </div>
            <Field label={px.secretLabels[platform]} htmlFor="px-secret" hint={pixel?.hasSecret ? px.secretSaved : px.secretHints[platform]} error={err("secret")}>
              <Input id="px-secret" name="secret" type="password" dir="ltr" autoComplete="off" maxLength={500} placeholder={pixel?.hasSecret ? "••••••••" : ""} onChange={(ev) => setSecretTyped(Boolean(ev.target.value))} />
            </Field>
            {pixel?.hasSecret && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="clearSecret" className="size-4 accent-[var(--color-accent)]" /> {px.clearSecret}
              </label>
            )}
            {platform !== "ga4" && (
              <Field label={px.testCode} htmlFor="px-test" hint={px.testCodeHint} error={err("testCode")}>
                <Input id="px-test" name="testCode" dir="ltr" maxLength={40} defaultValue={pixel?.testCode ?? ""} placeholder="TEST12345" />
              </Field>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={px.purchaseOn} htmlFor="px-purchase" hint={px.purchaseHint}>
            <Select id="px-purchase" name="purchaseOn" value={purchaseOn} onChange={(ev) => setPurchaseOn(ev.target.value as typeof purchaseOn)}>
              {purchaseTriggers.map((p) => (
                <option key={p} value={p}>
                  {px.purchaseOptions[p]}
                </option>
              ))}
            </Select>
            {purchaseOn !== "placed" && (!hasServer || (!pixel?.hasSecret && !secretTyped)) && <p className="mt-1.5 text-xs text-amber-300">{px.purchaseNeedsSecret}</p>}
          </Field>
          <Field label={px.scope} htmlFor="px-scope" hint={px.scopeHint} error={err("productIds")}>
            <Select id="px-scope" name="scope" value={scope} onChange={(ev) => setScope(ev.target.value)}>
              <option value="all">{px.scopes.all}</option>
              <option value="products">{px.scopes.products}</option>
            </Select>
          </Field>
        </div>
        {scope === "products" &&
          (products.length ? (
            <div className="grid max-h-52 gap-1.5 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2" data-testid="pixel-products">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="productIds" value={p.id} defaultChecked={pixel?.productIds?.includes(p.id)} className="size-4 accent-[var(--color-accent)]" />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{px.noProducts}</p>
          ))}

        <div className="flex gap-2">
          <SubmitButton pending={pending} pendingText={t.common.loading}>
            {px.save}
          </SubmitButton>
          <Button type="button" variant="secondary" onClick={onDone}>
            {px.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PixelCard({ lang, pixel, onEdit, t }: { lang: string; pixel: PixelRow; onEdit: () => void; t: Text }) {
  const px = t.pixels;
  const e = t.errors as Record<string, string>;
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [active, setActive] = useState(pixel.active);
  const run = (fn: () => Promise<ActionState>, showOk = false) =>
    startTransition(async () => {
      const r = await fn().catch((): ActionState => ({ ok: false, error: "unexpected" }));
      if (r.ok) setResult(showOk ? { ok: true, text: fmt(px.testOk, { detail: r.message ?? "" }) } : null);
      else setResult({ ok: false, text: `${e[r.error ?? "unexpected"] ?? e.unexpected}${r.message ? `: ${r.message}` : ""}` });
    });
  const server = serverPlatforms.includes(pixel.platform) && pixel.hasSecret;
  return (
    <Card className={`space-y-3 ${active ? "" : "opacity-70"}`} data-pixel={pixel.tagId}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="me-auto min-w-0">
          <p className="font-semibold">{pixel.name}</p>
          <p className="text-xs text-muted">
            {px.platforms[pixel.platform]} · <bdi dir="ltr">{pixel.tagId}</bdi>
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            disabled={pending}
            onChange={(ev) => {
              const next = ev.target.checked;
              setActive(next);
              run(() => setPixelActive(lang, pixel.id, next));
            }}
            className="size-4 accent-[var(--color-accent)]"
            aria-label={px.active}
          />
          {active ? px.active : px.inactive}
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={server ? "accent" : "neutral"}>{server ? px.serverOn : px.serverOff}</Badge>
        <Badge tone="info">{px.purchaseOptions[pixel.purchaseOn]}</Badge>
        <Badge>{pixel.productIds ? fmt(px.productsCount, { n: pixel.productIds.length }) : px.allPages}</Badge>
        {pixel.testCode && <Badge tone="warning">{px.testCode.split(" (")[0]}</Badge>}
      </div>
      {result && <Alert variant={result.ok ? "success" : "error"}>{result.text}</Alert>}
      <div className="flex flex-wrap gap-1">
        <Button variant="secondary" className="py-1.5 text-xs" onClick={onEdit}>
          <Pencil size={14} /> {px.edit}
        </Button>
        {server && (
          <Button variant="secondary" className="py-1.5 text-xs" disabled={pending} onClick={() => run(() => sendTestEvent(lang, pixel.id), true)}>
            <Send size={14} /> {px.test}
          </Button>
        )}
        <Button
          variant="secondary"
          className="py-1.5 text-xs hover:text-danger"
          disabled={pending}
          aria-label={t.common.delete}
          onClick={() => {
            if (confirm(px.confirmDelete)) run(() => deletePixel(lang, pixel.id));
          }}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </Card>
  );
}

export function PixelManager({ lang, pixels, products, t }: { lang: string; pixels: PixelRow[]; products: Product[]; t: Text }) {
  const px = t.pixels;
  const [editing, setEditing] = useState<string | null>(null);
  const close = () => setEditing(null);
  return (
    <div className="space-y-4">
      {editing === "new" ? (
        <PixelForm key="new" lang={lang} pixel={null} products={products} onDone={close} t={t} />
      ) : (
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} /> {px.add}
        </Button>
      )}
      {pixels.length === 0 && editing !== "new" ? (
        <EmptyState title={px.emptyTitle}>
          <p>{px.emptyBody}</p>
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pixels.map((p) =>
            editing === p.id ? (
              <div key={p.id} className="lg:col-span-2">
                <PixelForm lang={lang} pixel={p} products={products} onDone={close} t={t} />
              </div>
            ) : (
              <PixelCard key={p.id} lang={lang} pixel={p} onEdit={() => setEditing(p.id)} t={t} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
