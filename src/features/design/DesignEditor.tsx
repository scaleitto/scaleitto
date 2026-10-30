"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import type { ActionState } from "@/lib/action";
import { Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { ImageManager } from "@/ui/ImageManager";
import { AnnouncementBar, Hero, ProductGrid, StoreFooter, StoreFrame, StoreHeader, TrustBadges, type GridProduct } from "@/features/storefront/blocks";
import { colorPresets, storeTheme, styleChoices, type StoreDesign, type StyleOverrides } from "./types";

const fontNames: Record<string, string> = { cairo: "Cairo", tajawal: "Tajawal", almarai: "Almarai", changa: "Changa", "el-messiri": "El Messiri", plex: "IBM Plex", kufi: "Noto Kufi", readex: "Readex" };

export type DesignText = Pick<Dictionary, "design" | "media" | "errors" | "common">;

type Preview = { shopName: string; phone: string | null; locale: Locale; storeText: StoreText; currency: string; products: GridProduct[] };

function Toggle({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
      {label}
    </label>
  );
}

function Section({ title, hint, children, aside }: { title: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export function DesignEditor({ t, initial, preview, storeHref, action }: { t: DesignText; initial: { primaryColor: string; logoUrl: string | null; design: StoreDesign }; preview: Preview; storeHref: string; action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const d = t.design;
  const e = t.errors as Record<string, string>;
  const { state, pending, onSubmit } = useActionForm(action);
  const err = (f: string) => fieldError(state, e, f);

  const [color, setColor] = useState(initial.primaryColor);
  const [logo, setLogo] = useState(initial.logoUrl ? [initial.logoUrl] : []);
  const [design, setDesign] = useState(initial.design);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const set = <K extends keyof StoreDesign>(key: K, value: StoreDesign[K]) => setDesign((prev) => ({ ...prev, [key]: value }));
  const validColor = /^#[0-9a-f]{6}$/i.test(color) ? color : initial.primaryColor;
  const theme = storeTheme(design);
  const styleLabel = (key: keyof StyleOverrides, v: string | number) => (key === "font" ? fontNames[v] : (d.styleOptions as Record<string, string>)[key === "cards" && v === "minimal" ? "minimalCard" : String(v)]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <input type="hidden" name="logoUrl" value={logo[0] ?? ""} />
        <input type="hidden" name="heroImage" value={design.hero.image} />
        <FormMessage state={state} errors={e} success={t.common.saved} />

        <Section title={d.identity}>
          <Field label={d.logo} hint={d.logoHint}>
            <ImageManager t={t.media} value={logo} onChange={setLogo} max={1} />
          </Field>
          <Field label={d.color} htmlFor="primaryColor" hint={d.colorHint} error={err("primaryColor")}>
            <div className="flex flex-wrap items-center gap-2">
              <input type="color" aria-label={d.color} value={validColor} onChange={(ev) => setColor(ev.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-bg p-1" />
              <Input id="primaryColor" name="primaryColor" dir="ltr" className="w-28 font-mono" value={color} onChange={(ev) => setColor(ev.target.value.trim())} maxLength={7} />
              <div className="flex gap-1.5">
                {colorPresets.map((c) => (
                  <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={`size-7 rounded-full border-2 ${color === c ? "border-fg" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          </Field>
        </Section>

        <Section title={d.announcement} hint={d.announcementHint} aside={<Toggle name="announcementEnabled" checked={design.announcement.enabled} onChange={(v) => set("announcement", { ...design.announcement, enabled: v })} label={d.enabled} />}>
          {design.announcement.enabled && (
            <Field label={d.announcement} htmlFor="announcementText" error={err("announcementText")}>
              <Input id="announcementText" name="announcementText" maxLength={160} placeholder={d.announcementPlaceholder} value={design.announcement.text} onChange={(ev) => set("announcement", { ...design.announcement, text: ev.target.value })} />
            </Field>
          )}
          {!design.announcement.enabled && <input type="hidden" name="announcementText" value={design.announcement.text} />}
        </Section>

        <Section title={d.hero} hint={d.heroHint} aside={<Toggle name="heroEnabled" checked={design.hero.enabled} onChange={(v) => set("hero", { ...design.hero, enabled: v })} label={d.enabled} />}>
          <div className={design.hero.enabled ? "space-y-4" : "hidden"}>
            <Field label={d.heroImage}>
              <ImageManager t={t.media} value={design.hero.image ? [design.hero.image] : []} onChange={(imgs) => set("hero", { ...design.hero, image: imgs[0] ?? "" })} max={1} />
            </Field>
            <Field label={d.heroTitle} htmlFor="heroTitle" error={err("heroTitle")}>
              <Input id="heroTitle" name="heroTitle" maxLength={120} placeholder={d.heroTitlePlaceholder} value={design.hero.title} onChange={(ev) => set("hero", { ...design.hero, title: ev.target.value })} />
            </Field>
            <Field label={d.heroSubtitle} htmlFor="heroSubtitle">
              <Textarea id="heroSubtitle" name="heroSubtitle" rows={2} maxLength={300} value={design.hero.subtitle} onChange={(ev) => set("hero", { ...design.hero, subtitle: ev.target.value })} />
            </Field>
            <Field label={d.heroButton} htmlFor="heroButtonText">
              <Input id="heroButtonText" name="heroButtonText" maxLength={40} placeholder={d.heroButtonPlaceholder} value={design.hero.buttonText} onChange={(ev) => set("hero", { ...design.hero, buttonText: ev.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title={d.homepage}>
          <Field label={d.productsTitle} htmlFor="productsTitle">
            <Input id="productsTitle" name="productsTitle" maxLength={80} placeholder={preview.storeText.products} value={design.productsTitle} onChange={(ev) => set("productsTitle", ev.target.value)} />
          </Field>
          <Toggle name="showBadges" checked={design.showBadges} onChange={(v) => set("showBadges", v)} label={d.showBadges} />
          <Toggle name="showOrderSteps" checked={design.showOrderSteps} onChange={(v) => set("showOrderSteps", v)} label={d.showOrderSteps} />
        </Section>

        <Section title={d.styleTitle} hint={d.styleHint}>
          <div className="grid gap-3 sm:grid-cols-2" data-testid="style-overrides">
            {(Object.keys(styleChoices) as (keyof StyleOverrides)[]).map((key) => {
              const name = `style${key[0].toUpperCase()}${key.slice(1)}`;
              return (
                <Field key={key} label={d.styleLabels[key]} htmlFor={name}>
                  <Select id={name} name={name} value={String(design.style[key] || "")} onChange={(ev) => set("style", { ...design.style, [key]: key === "columns" ? Number(ev.target.value) || 0 : ev.target.value })}>
                    <option value="">{d.themeDefault}</option>
                    {styleChoices[key].map((v) => (
                      <option key={v} value={v}>
                        {styleLabel(key, v)}
                      </option>
                    ))}
                  </Select>
                </Field>
              );
            })}
          </div>
        </Section>

        <Section title={d.footer}>
          <Field label={d.about} htmlFor="about" error={err("about")}>
            <Textarea id="about" name="about" rows={3} maxLength={1000} placeholder={d.aboutPlaceholder} value={design.about} onChange={(ev) => set("about", ev.target.value)} />
          </Field>
          <p className="text-sm font-medium">{d.socials}</p>
          {([
            ["facebook", "Facebook"],
            ["instagram", "Instagram"],
            ["tiktok", "TikTok"],
          ] as const).map(([k, label]) => (
            <Field key={k} label={label} htmlFor={k} error={err(k)}>
              <Input id={k} name={k} dir="ltr" placeholder={`https://${k}.com/…`} value={design.socials[k]} onChange={(ev) => set("socials", { ...design.socials, [k]: ev.target.value })} />
            </Field>
          ))}
          <Field label={d.whatsapp} htmlFor="whatsapp" error={err("whatsapp")}>
            <Input id="whatsapp" name="whatsapp" dir="ltr" inputMode="tel" placeholder="0555 12 34 56" value={design.socials.whatsapp} onChange={(ev) => set("socials", { ...design.socials, whatsapp: ev.target.value })} />
          </Field>
          <Toggle name="floatingWhatsapp" checked={design.floatingWhatsapp} onChange={(v) => set("floatingWhatsapp", v)} label={d.floatingWhatsapp} />
        </Section>

        <div className="sticky bottom-0 z-10 -mx-1 flex justify-end bg-bg/90 px-1 py-3 backdrop-blur">
          <SubmitButton pending={pending} pendingText={t.common.loading}>
            {t.common.save}
          </SubmitButton>
        </div>
      </form>

      <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">{d.preview}</h2>
            <p className="text-xs text-muted">{d.previewHint}</p>
          </div>
          <div className="flex items-center gap-1">
            {(["desktop", "mobile"] as const).map((dev) => (
              <button
                key={dev}
                type="button"
                aria-pressed={device === dev}
                onClick={() => setDevice(dev)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${device === dev ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"}`}
              >
                {dev === "desktop" ? <Monitor size={14} /> : <Smartphone size={14} />} {dev === "desktop" ? d.desktop : d.mobile}
              </button>
            ))}
            <a href={storeHref} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-accent hover:underline">
              <ExternalLink size={14} /> {d.openStore}
            </a>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-panel-2 p-3">
          {/* The real storefront blocks with the unsaved values: the frame scrolls, the store inside is inert
              (pointer-events-none on the scrolling box itself stopped the wheel and the scrollbar) */}
          <div className={`mx-auto max-h-[75vh] overflow-y-auto overscroll-contain rounded-lg bg-white shadow-xl ${device === "mobile" ? "max-w-[390px]" : ""}`} data-testid="design-preview">
            <div className="pointer-events-none select-none" inert>
            <StoreFrame locale={preview.locale} color={validColor} theme={theme}>
              {design.announcement.enabled && design.announcement.text && <AnnouncementBar text={design.announcement.text} />}
              <StoreHeader name={preview.shopName} logoUrl={logo[0] ?? null} phone={preview.phone} whatsapp={design.socials.whatsapp} homeHref="#" align={theme.layout.header} t={preview.storeText} />
              <div className="space-y-6 p-4">
                {design.hero.enabled && <Hero hero={design.hero} variant={theme.layout.hero} t={preview.storeText} />}
                {design.showBadges && <TrustBadges t={preview.storeText} />}
                <ProductGrid title={design.productsTitle} products={preview.products} base="#" currency={preview.currency} t={preview.storeText} layout={theme.layout} />
              </div>
              <StoreFooter name={preview.shopName} about={design.about} socials={design.socials} phone={preview.phone} t={preview.storeText} />
            </StoreFrame>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
