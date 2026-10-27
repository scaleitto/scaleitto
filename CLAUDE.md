@AGENTS.md

# Scaleitto

Multi-tenant e-commerce SaaS for Algerian merchants (like YouCan / ayor.ai): each merchant gets a shop with
cash-on-delivery checkout. The owner of the repo is not a programmer — explain changes in Arabic, simply.

## Stack
- Next.js 16 App Router (Cache Components on, `output: "standalone"`), React 19, TypeScript, Tailwind v4
- MySQL/MariaDB via Drizzle ORM + mysql2 (target host: Namecheap shared cPanel, later a VPS)
- No Redis, no background workers yet (shared hosting) — design jobs so they can run from cron later

## Commands
- `npm run dev` / `npm run build` / `npm run lint` / `npm run typecheck` / `npm test` / `npm run test:e2e`
- `npm run db:generate -- --name <change>` after editing `src/server/db/schema.ts`, then `npm run db:migrate`
- `scripts/migrate.mjs` must only depend on `mysql2` (it runs from the standalone bundle on the server)

## Layout (v2 — rebuilt cleanly, one section at a time)
- `src/app/[lang]/…` — marketing, auth, merchant dashboard. `lang` ∈ ar|fr|en (RTL for ar). Pages stay thin:
  they call a guard and render feature components.
- `src/features/<section>/` — each section's `actions.ts` (server actions), `components.tsx`, validators.
- `src/ui/` — shared UI kit (`Button`, `Card`, `Field`, `Input`, `Alert`, `PageHeader`…) and `ui/form.tsx`
  (`useActionForm` — forms never lose typed values after an error —, `SubmitButton`, `FormMessage`, `fieldError`).
  Colors are tokens in `src/app/globals.css` (dark dashboard, green accent).
- `src/lib/permissions.ts` — the ONLY place that says which role sees which sidebar section (sidebar order =
  the owner's image: Overview, Products, Orders, Delivery, Store Design, Theme Store, Call Centers, Landing Pages,
  Analytics, Pixels, Apps, Plans, Settings, Profile). Roles: owner / manager / agent (call center).
- `src/server/auth/` — sessions, passwords, `requireShop()`, `requireSection(lang, key)` (redirects to the
  member's home section when not allowed), `requirePlatformAdmin()`.
- `src/server/errors.ts` — every server action is wrapped in `safeAction(where, fn)`: errors are logged to
  `error_logs` and the user gets a translated message, never a crash screen. Validation errors are `e:<key>`
  message keys mapped by `fieldErrorsFrom` to `t.errors.<key>`.
- `src/server/db/schema.ts` — Drizzle schema (v2 baseline migration `drizzle/0000_init.sql`; v2 needs a fresh DB).
- `src/i18n/dictionaries/{ar,fr,en}.ts` — all strings (ar is the typed source of truth). Every new UI string goes in all three.
- Products (`src/features/products/`): `validators.ts` (zod; options/variants/offers arrive as JSON fields),
  `variants.ts` (variants are rebuilt on the server from the options; existing rows keep their id by title),
  `queries.ts`, `actions.ts`, `ProductForm.tsx`, `ProductList.tsx`. Plan ceilings: `src/server/limits.ts` (`canAdd`;
  add a counter there when a section with a limit is built).
- Uploads: `src/ui/ImageManager.tsx` resizes in the browser and POSTs one raw image to `/api/uploads`;
  `src/server/storage.ts` sniffs and stores it under UPLOADS_DIR (outside the app) and returns a path
  `/uploads/<shop>/<file>` (not a full URL) served by `src/app/uploads/[shop]/[file]/route.ts`.
  Filesystem calls on those paths carry `/* turbopackIgnore: true */` so the build does not trace the whole project.
- Storefront (`src/app/store/[slug]/…`, light theme, shop language from `shops.default_locale`, strings in
  `src/i18n/store.ts`): home, product page (`src/features/storefront/CheckoutForm.tsx`), thanks page.
  `src/features/checkout/`: `place-order.ts` (one function used by every order form: stock is taken atomically,
  per-shop order numbers from #1001, history event, abandoned cart → converted), `protection.ts` (blocked phones,
  duplicates, per-phone/IP limits, honeypot), `pricing.ts` (offers, shipping per wilaya; no rates → free).
- Orders dashboard (`src/features/orders/`): list with status counts/search, detail (status, customer edit,
  phone history + block, notes, history), abandoned carts. Cancelled/returned orders give stock back (`holdsStock`).
- Delivery (`src/features/delivery/`): `carriers.ts` (catalog; couriers grouped by platform: yalidine, ecotrack —
  one API on <name>.ecotrack.dz for 80+ couriers —, procolis = ZR Express, noest), `platforms/*` (one client per
  platform: test / createParcel / trackingStatus), keys encrypted with `src/server/crypto.ts` (APP_SECRET, falls back
  to DATABASE_URL). Rates per wilaya in `shipping_rates`; sending/tracking from the order page (`ShipmentCard`);
  delivered/returned parcels close the order through `src/features/orders/transition.ts` (`applyOrderStatus`, the
  only place that changes an order status: stock + history). E2E tests use `tests/e2e/mock-carriers.mjs` via
  E2E_CARRIER_URL (never set it in production). API formats were taken from open-source clients (CourierDZ), not
  official docs: verify with a real merchant account before relying on a platform.
- Store Design (`src/features/design/`): `shops.design` JSON read through `resolveDesign()` (defaults for missing keys —
  add new options there), `validators.ts`, `DesignEditor.tsx` (form + live preview). The storefront is drawn from
  `src/features/storefront/blocks.tsx` (plain components shared by the real store and the preview — change the
  look there, not in pages).
- Themes (`src/features/themes/themes.ts`): each theme = tokens (font, surfaces, radii, card style) + layout
  switches (header, hero, columns, image shape). `themeStyle()` sets CSS variables on `StoreFrame`; storefront
  code uses only the `s-*` colors (`bg-s-surface`, `text-s-muted`, `border-s-line`…), `rounded-[var(--s-radius)]`,
  `rounded-[var(--s-radius-btn)]` and `shadow-[var(--s-shadow)]` — never fixed slate/white colors, or dark themes
  break. Fonts for all themes are declared once in `src/app/fonts.ts`. The chosen theme is `design.theme`.
- Call centers (`src/features/team/`): members are added by owners/managers (one account = one shop; `maxStaff`
  counts active members), with role, work schedule (`WorkSchedule`, Algeria time) and active flag (deactivating
  deletes their sessions and releases their open orders). New orders are assigned in `place-order.ts` via
  `assign.ts → pickAgent` (shops.assign_mode: manual / balanced / on_shift). Agents only see and change orders
  assigned to them: every order query/action goes through `src/features/orders/access.ts` (`visibleOrders`,
  `canTouchOrder`) — keep it that way for new order features. Working time comes from `/api/activity` (heartbeat
  from `ActivityPing`, max one minute per minute) into `member_activity`; `metrics.ts` computes performance
  (confirmations, rates, response time, attendance/punctuality/coverage via `schedule.ts`). Times: `src/lib/time.ts`
  (Africa/Algiers); `formatDate`/`formatTime` always render Algeria time.
- Landing pages (`src/features/landing/`): `landing_pages.sections` (typed in `types.ts`, always read through
  `sanitizeSections`) and `.form` (`FormSettings`, read through `resolveForm`: title/button texts, layout, address
  hidden/optional/required — home delivery only —, note, delivery both/home/office, custom fields `custom_<id>` saved in
  `orders.extra`, thank-you message, sticky button). `blocks.tsx` draws the sections for the public page
  (`/store/<slug>/lp/<page>`) and the editor preview (`LandingEditor.tsx`); the form is the shared `CheckoutForm`, validated
  again in `checkout/actions.ts`. Embeddable form: `/embed/<slug>/<page>` (own root layout, `HeightReporter` posts its
  height to the parent). Visits: `/api/lp/view` once per browser session.
- AI pages: `src/server/ai/openai.ts` (Responses API in background mode — start, then the browser polls `checkAiLanding`
  every 3 s; model chain OPENAI_MODEL → gpt-6.1-sol → gpt-6.1-luna → gpt-6-luna; rejected params retried without them;
  `checkAiConnection` for the dashboard test card). Prompt + schema + post-processing in `ai-prompt.ts` (never invents
  facts, never writes reviews/countdowns; unknown images dropped; form placed after hero/badges). Generations are rows in
  `ai_generations` (claimed pending → saving so a page is created once). E2E uses `tests/e2e/mock-openai.mjs`
  (OPENAI_BASE_URL=http://127.0.0.1:4020/v1, OPENAI_API_KEY=sk-test).
- Analytics (`src/features/analytics/`): `range.ts` (presets today…90d/month or custom ≤ 366 days, in Algeria days, plus
  the previous period of the same length), `queries.ts` (loads the period's orders/items/leads once), `compute.ts`
  (pure, unit-tested: confirmation = confirmed ÷ (confirmed + cancelled), delivery = delivered ÷ (delivered + returned),
  delivered sales, estimated profit from products' cost price, daily/hourly series, products, wilayas, sources),
  `views.tsx` (server components; CSS-only chart tooltips; charts stay left-to-right). Rate changes are shown in points.
- Pixels (`src/features/pixels/`): `pixels` rows (meta / tiktok / ga4 / gtm; tag IDs checked by `ids.ts` because they go
  into inline scripts; optional encrypted server secret + test code; `purchaseOn` placed/confirmed/delivered; `productIds`
  null = whole store). Browser: `PixelScope` on every storefront page (pages pass `pagePixels(shop, productIds)`) loads only
  that page's pixels and sends events with `track.ts` (Meta trackSingle, TikTok instance, GA4 send_to, GTM dataLayer);
  `CheckoutForm` fires InitiateCheckout via `useCheckoutStarted`; thank-you pages fire Purchase (event id = order id) or
  Lead for pixels waiting for confirmation/delivery. Server: `server.ts` (Conversions API, Events API, Measurement Protocol)
  via `scheduleOrderEvents` → `after()`: on placement (`checkout/actions.ts`, ad cookies saved in `orders.tracking`) and on
  confirmed/delivered (`applyOrderStatus`). `pixel_events` = log + unique (pixel, order, event) so nothing is sent twice.
  E2E uses `tests/e2e/mock-pixels.mjs` via E2E_PIXEL_URL (never set it in production).
- Apps (`src/features/apps/`): `shop_apps` (google_sheets / webhook; merchant URL + encrypted secret, one per kind) and the
  `app_events` log. `sync.ts`: `scheduleOrderSync` (→ `after()`) is called on placement, every status change
  (`applyOrderStatus`), customer edit and assignment; the sheet gets one row per order keyed by the order number (headers
  in the shop's language, script in `apps-script.ts`, deployed by the merchant as an Apps Script web app — Ecomanager has
  no public API and reads that sheet), webhooks get signed JSON (`X-Scaleitto-Signature` HMAC sha256). Merchant URLs go
  through `safePostJson`. Product import: `catalog.ts` (pure parsers: Shopify public `/products.json`, YouCan API —
  YouCan format unverified), `importer.ts` (drafts, photos copied, `products.external_ref` unique so nothing is imported
  twice); the browser imports one product per request. E2E: `tests/e2e/mock-apps.mjs` via E2E_APPS_URL with
  ALLOW_PRIVATE_FETCH=1 (tests only, never in production).
- Dashboard `error.tsx` / `not-found.tsx` keep the sidebar and show a friendly message (errors are in error_logs).
- Any server-side fetch of a user URL must go through `src/server/safe-fetch.ts` (product links: `src/server/product-import.ts`).
- The server applies pending migrations at startup (`src/instrumentation-node.ts` → `scripts/migrate-lib.mjs`);
  `/api/health` shows version, DB, migrations and env status.

## Testing (required before pushing every section)
- `npm test` — unit tests in `tests/unit/` (node test runner via tsx).
- `npm run test:e2e` — Playwright flows in `tests/e2e/phaseN.mjs` against a running server (E2E_URL, default
  localhost:3000) with the DB from `.env`; also fails if any new row appears in `error_logs`.
- Each new section adds its own `tests/e2e/phaseN.mjs` and registers it in `tests/e2e/run.mjs`.
- CI (`.github/workflows/build.yml`) runs lint, typecheck, unit tests, build and the e2e tests on MariaDB, then
  publishes the deploy artifact.

## Rules
- Tenant isolation: every dashboard query/mutation filters by `shop.id` from `requireShop()`/`requireSection()`;
  never trust ids from the client alone.
- Money is integer DZD.
- Next 16 + Cache Components: pages under `[lang]` and `store` set `instant = false` in their root layout;
  call `connection()` before using `new Date()`/random values in server components outside a session read.
- Root layouts are `src/app/[lang]/layout.tsx` and (when the storefront is rebuilt) `src/app/store/layout.tsx`.
- No duplicated logic: reuse `src/ui`, `safeAction`, `permissions.ts`. Build a section completely, with its e2e
  test passing, before starting the next one.

## Roadmap (from the owner's feature list)
v2 rebuild order (sidebar): Phase 0 done (foundation, dark shell, auth, roles, profile), Phase 1 done (Products), Phase 2 done (Orders + storefront checkout, fake-order protection, abandoned carts), Phase 3 done (Delivery), Phase 4 done (Store Design), Phase 5 done (Theme Store), Phase 6 done (Call Centers), Phase 7 done (Landing Pages + AI + embeddable form), Phase 8 done (Analytics), Phase 9 done (Pixels: Meta, TikTok, GA4, GTM + server events), Phase 10 done (Apps: Google Sheets/Ecomanager, webhook, Shopify/YouCan import).
Next: Plans (limits/contracts/thresholds), Settings (custom domain), platform admin, AI last.
The v1 code (main branch) has working versions of most features to consult while rebuilding.
