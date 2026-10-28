"use client";

import { useState, useTransition } from "react";
import { Check, Eye, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Locale } from "@/i18n/config";
import type { StoreText } from "@/i18n/store";
import { fmt } from "@/lib/format";
import { Alert, Badge, Button } from "@/ui";
import { Hero, ProductGrid, StoreFooter, StoreFrame, StoreHeader, TrustBadges, type GridProduct } from "@/features/storefront/blocks";
import type { StoreDesign } from "@/features/design/types";
import { applyTheme } from "./actions";
import { themes, type Theme } from "./themes";

const DEFAULT_COLOR = "#10b981";

type Shop = { name: string; phone: string | null; logoUrl: string | null; color: string; design: StoreDesign };
type Preview = { locale: Locale; storeText: StoreText; currency: string; products: GridProduct[] };

// The store drawn with a theme: the merchant's own content when it exists, samples otherwise.
function ThemePreview({ theme, color, shop, preview, t, compact }: { theme: Theme; color: string; shop: Shop; preview: Preview; t: Dictionary["themes"]; compact?: boolean }) {
  const hero = shop.design.hero.enabled ? shop.design.hero : { enabled: true, image: "", title: t.sampleTitle, subtitle: t.sampleText, buttonText: t.sampleButton };
  const products = preview.products.length
    ? preview.products
    : [1, 2, 3, 4].map((n) => ({ id: String(n), slug: String(n), name: fmt(t.sampleProduct, { n }), price: 2500 + n * 500, compareAtPrice: n % 2 ? 4000 + n * 500 : null, images: [] }));
  return (
    <StoreFrame locale={preview.locale} color={color} theme={theme}>
      <StoreHeader name={shop.name} logoUrl={shop.logoUrl} phone={compact ? null : shop.phone} homeHref="#" align={theme.layout.header} t={compact ? undefined : preview.storeText} />
      <div className="space-y-6 p-4">
        <Hero hero={hero} variant={theme.layout.hero} t={compact ? undefined : preview.storeText} />
        {!compact && shop.design.showBadges && <TrustBadges t={preview.storeText} />}
        <ProductGrid title={shop.design.productsTitle} products={compact ? products.slice(0, theme.layout.columns) : products} base="#" currency={preview.currency} t={preview.storeText} layout={theme.layout} />
      </div>
      {!compact && <StoreFooter name={shop.name} about={shop.design.about} socials={shop.design.socials} t={preview.storeText} />}
    </StoreFrame>
  );
}

export function ThemeGallery({ lang, shop, preview, t }: { lang: "ar" | "fr" | "en"; shop: Shop; preview: Preview; t: Pick<Dictionary, "themes" | "errors" | "common"> }) {
  const th = t.themes;
  const [current, setCurrent] = useState(shop.design.theme);
  const [color, setColor] = useState(shop.color);
  const [open, setOpen] = useState<Theme | null>(null);
  // A merchant who never picked a color (platform default) gets the theme's color by default
  const [keepColor, setKeepColor] = useState(shop.color !== DEFAULT_COLOR);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (theme: Theme) =>
    startTransition(async () => {
      const r = await applyTheme(lang, theme.key, keepColor);
      const errors = t.errors as Record<string, string>;
      if (r.ok) {
        setCurrent(theme.key);
        if (!keepColor) setColor(theme.color);
        setOpen(null);
        setMessage({ ok: true, text: fmt(th.applied, { name: theme.name[lang] }) });
      } else setMessage({ ok: false, text: errors[r.error ?? "unexpected"] ?? errors.unexpected });
    });

  return (
    <div className="space-y-4">
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => {
          const active = theme.key === current;
          return (
            <li key={theme.key} data-theme-card={theme.key} className={`overflow-hidden rounded-xl border bg-panel ${active ? "border-accent ring-2 ring-accent/30" : "border-line"}`}>
              {/* Mini preview: the real store drawn at half size */}
              <button type="button" onClick={() => setOpen(theme)} className="block h-56 w-full overflow-hidden bg-panel-2 text-start" aria-label={`${th.preview} ${theme.name[lang]}`}>
                <div className="pointer-events-none w-[250%] origin-top-left scale-[0.4] select-none rtl:origin-top-right" inert>
                  <ThemePreview theme={theme} color={theme.color} shop={shop} preview={preview} t={th} compact />
                </div>
              </button>
              <div className="flex items-center justify-between gap-2 p-4">
                <div className="flex items-center gap-2">
                  <span className="size-4 rounded-full" style={{ background: theme.color }} />
                  <span className="font-semibold">{theme.name[lang]}</span>
                  {active && <Badge tone="accent">{th.current}</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setOpen(theme)}>
                    <Eye size={14} /> {th.preview}
                  </Button>
                  {!active && (
                    <Button variant="secondary" className="px-3 py-1 text-xs" disabled={pending} onClick={() => apply(theme)}>
                      {th.apply}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={keepColor} onChange={(e) => setKeepColor(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
        {th.keepColor} <span className="text-xs text-muted">({th.keepColorHint})</span>
      </label>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6" role="dialog" aria-modal aria-label={open.name[lang]}>
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-t-xl bg-panel px-4 py-3">
            <span className="font-semibold">{open.name[lang]}</span>
            <div className="flex items-center gap-2">
              {open.key === current ? (
                <Badge tone="accent">{th.current}</Badge>
              ) : (
                <Button disabled={pending} onClick={() => apply(open)}>
                  <Check size={15} /> {th.apply}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setOpen(null)} aria-label={th.close}>
                <X size={18} />
              </Button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto rounded-b-xl bg-white" data-testid="theme-preview">
            <div className="pointer-events-none select-none" inert>
              <ThemePreview theme={open} color={keepColor ? color : open.color} shop={shop} preview={preview} t={th} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
