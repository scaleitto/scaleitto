@AGENTS.md

# Scaleitto

Multi-tenant e-commerce SaaS for Algerian merchants (like YouCan / ayor.ai): each merchant gets a shop with
cash-on-delivery checkout. The owner of the repo is not a programmer — explain changes in Arabic, simply.

## Stack
- Next.js 16 App Router (Cache Components on, `output: "standalone"`), React 19, TypeScript, Tailwind v4
- MySQL/MariaDB via Drizzle ORM + mysql2 (target host: Namecheap shared cPanel, later a VPS)
- No Redis, no background workers yet (shared hosting) — design jobs so they can run from cron later

## Commands
- `npm run dev` / `npm run build` / `npm run lint`
- `npm run db:generate -- --name <change>` after editing `src/db/schema.ts`, then `npm run db:migrate`
- `scripts/migrate.mjs` must only depend on `mysql2` (it runs from the standalone bundle on the server)

## Layout
- `src/app/[lang]/…` — marketing, auth, merchant dashboard, platform admin. `lang` ∈ ar|fr|en (RTL for ar)
- `src/app/store/[slug]/…` — public storefronts. `src/proxy.ts` rewrites `<slug>.ROOT_DOMAIN` here
- `src/i18n/dictionaries/{ar,fr,en}.ts` — dashboard strings (ar is the typed source of truth);
  `src/i18n/store.ts` — customer-facing storefront strings. Every new UI string goes in all three languages.
- `src/lib/auth.ts` — sessions + `requireShop()`; `src/lib/limits.ts` — plan limits overridden by shop contracts

## Rules
- Tenant isolation: every dashboard query/mutation filters by `shop.id` from `requireShop()`; never trust ids from the client alone.
- Money is integer DZD.
- Next 16 + Cache Components: pages under `[lang]` and `store` set `instant = false` in their root layout;
  call `connection()` before using `new Date()`/random values in server components outside a session read.
- Root layouts are `src/app/[lang]/layout.tsx` and `src/app/store/layout.tsx` (no `src/app/layout.tsx`).
- Test the real flow in a browser (Playwright is preinstalled) before pushing.

## Roadmap (from the owner's feature list)
Done: shops, staff roles (schema), products + variants + SKU/stock, COD orders, wilaya shipping rates,
fake-order checks (phone format, per-phone/IP limits, honeypot), plans, per-shop contracts with custom
ceilings and dates, usage threshold alerts, ar/fr/en.
Next: landing pages, Meta/TikTok pixels + GTM, abandoned carts, leads, upsell/cross-sell, staff invites,
delivery companies (Yalidine, ZR Express, Noest…), Google Sheets, Ecomanager, Stripe, custom domains,
YouCan/Shopify import, analytics, themes, markets/currencies, AI features, mobile app.
