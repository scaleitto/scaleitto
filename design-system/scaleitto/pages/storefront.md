# Storefront & landing pages (overrides MASTER for what customers see)

Customers arrive from Facebook/TikTok ads on phones and order with cash on delivery. One job per page: make the
product clear and the order form effortless. UI/UX Pro Max query: "ecommerce product landing page mobile conversion"
(density 5, variance 5, motion 3). Its testimonial-led pattern is NOT used: the platform never writes reviews; real
reviews only when the merchant adds them.

## Colors
Each theme sets `s-*` surfaces (themes.ts). The merchant's main color is `--brand`; never put fixed white text on it:
- `text-brand-fg` on `bg-brand` (white or near-black, whichever reads at 4.5:1 — `textOn` in src/lib/contrast.ts)
- `text-brand-ink` for the color used as text on cards (prices, links, icons) — darkened/lightened until 4.5:1
  (`readableOn`). Both are set by `brandVars(color, theme)` (StoreFrame and landing pages with their own color).

## Order form (CheckoutForm)
16px inputs (no iOS zoom), visible labels, the right keyboard (`inputMode="tel"`, autocomplete), errors under the field
with `aria-invalid` and a red edge, selects with `select-chevron`, one big submit showing the total and a spinner while
sending, sticky "order" button on phones while the form is off screen.

## Icons
SVG only (Lucide). Benefit cards use names from `landing/icons.ts` (`benefitIcons`); the AI schema is limited to those
names; older pages keep their emoji.

## Motion
Only the marquee band (stops with reduced motion). No entrance animations: pages must show content immediately (LCP).
