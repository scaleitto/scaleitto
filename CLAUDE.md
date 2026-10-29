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
  Colors are tokens in `src/app/globals.css` (light dashboard, green accent; `text-warning` / `text-info` instead of fixed amber/sky).
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
  one API on <name>.ecotrack.dz for 80+ couriers —, zrexpress = ZR Express's new platform api.zrexpress.app (X-Tenant +
  X-Api-Key, territory UUIDs found by wilaya code / commune name without accents, stop desk = the wilaya's pickup hub), procolis =
  ZR Express's old platform, noest), `platforms/*` (one client per
  platform: test / createParcel / trackingStatus), keys encrypted with `src/server/crypto.ts` (APP_SECRET, falls back
  to DATABASE_URL). Rates per wilaya in `shipping_rates`; sending/tracking from the order page (`ShipmentCard`);
  delivered/returned parcels close the order through `src/features/orders/transition.ts` (`applyOrderStatus`, the
  only place that changes an order status: stock + history). E2E tests use `tests/e2e/mock-carriers.mjs` via
  E2E_CARRIER_URL (never set it in production). API formats were taken from open-source clients (CourierDZ, dz-delivery for
  ZR's new platform), not official docs: verify with a real merchant account before relying on a platform. Courier status words
  → `delivery/status.ts` (ZR states pass through `readableState`). Meta Graph API version: `META_VERSION` in
  `src/server/meta.ts` (pixels + WhatsApp; Meta retires versions ~2 years after the next one: move it forward yearly).
- Store Design (`src/features/design/`): `shops.design` JSON read through `resolveDesign()` (defaults for missing keys —
  add new options there), `validators.ts`, `DesignEditor.tsx` (form + live preview). The storefront is drawn from
  `src/features/storefront/blocks.tsx` (plain components shared by the real store and the preview — change the
  look there, not in pages).
- Themes (`src/features/themes/themes.ts`): each theme = tokens (font, surfaces, radii, card style) + layout
  switches (header start/center, hero split/full/card/minimal, columns, image shape, product cards elevated/outline/minimal). `themeStyle()` sets CSS variables on `StoreFrame`; storefront
  code uses only the `s-*` colors (`bg-s-surface`, `text-s-muted`, `border-s-edge` — not `border-s-line`, Tailwind reads that as border-inline-start —…), `rounded-[var(--s-radius)]`,
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
- Plans (`src/features/plans/`, owner only): effective limits = plan (back to the free plan after `shops.plan_expires_at`)
  overridden by an active contract (`src/server/limits.ts`; monthly quotas use the Algeria month, `algeriaMonthStart`).
  Over `maxOrdersPerMonth` an order is still accepted but `orders.locked`: no customer details leave the server
  (`getOrder`/`listOrders` mask, search skips them), `canTouchOrder` refuses changes, no agent assignment, no app sync.
  `releaseLockedOrders` (orders pages, approval) unlocks past months and whatever the current limit now allows.
  Upgrades: `plan_requests` (CCP/RIB transfer with a receipt upload, or WhatsApp; payment details from PAYMENT_HOLDER /
  PAYMENT_CCP / PAYMENT_RIB / PAYMENT_WHATSAPP), approved on `/[lang]/admin/plan-requests` (platform admin) →
  `approvePlanRequest` (plan + paid period). Dashboard banner (`planNotice`): locked orders, or a monthly quota past the
  contract's alert threshold (default 80%). Lists shared with browser code live in `src/lib/enums.ts`.
- Settings (`src/features/settings/`): store details (name, phone, store language, link — `shopSlugSchema` shared with
  sign-up), SEO (`shops.seo` → store layout metadata, title template "%s | shop"), policy pages (`shops.policies`,
  `/store/<slug>/policies/<kind>`, footer links). Custom domain (paid plans with the `custom_domain` feature): the merchant
  adds TXT `_scaleitto.<domain>` = `scaleitto-verify=<token>` and a CNAME www → DOMAIN_CNAME_TARGET (or A → SERVER_IP);
  `checkDomain` verifies (E2E_DNS_URL = fake resolver in tests). `proxy.ts` rewrites any non-platform host to
  `/store/<host>/…`; `getShopBySlug` resolves a dotted key by verified domain + plan. `storeUrl(shop)` prefers the domain.
  `/api/domains/check?domain=` answers 200 only for served domains (on-demand TLS "ask" URL on a VPS).
- Platform admin (`/[lang]/admin`, `requirePlatformAdmin` in the layout AND every page/action; the account whose email is
  PLATFORM_ADMIN_EMAIL at sign-up): overview, stores (search, plan + paid period, contracts that override plan limits,
  suspend → storefront 404 and members sent to `/[lang]/suspended` by `requireShop`), plan requests, plans editor (codes
  fixed; `starter` = free fallback; only the `custom_domain` feature is enforced), system (version, migrations, which
  server settings are set, AI check, error log). Data in `src/features/admin/queries.ts`, forms in `AdminForms.tsx`.
  The shell (`DashboardShell`) serves both areas; the platform admin sees an admin link in the merchant header.
- Call-center AI (`src/features/ai/`): small AI tasks share `tasks.ts` (`startTask` → background request + an
  `ai_generations` row with `kind`, counted in `maxAiPerMonth`; `pollTask` → clean, save, return `result`) and the browser
  hook `useAiTask`. Prompts/schemas in `prompts.ts` (same honesty rules as landing pages): `call_guide` (saved on
  `products.call_guide`, shown on the order page by `CallGuideCard`), `messages` (rewrites the customer messages, returned
  to the editor), `description` (fills the product form). Customer messages (`src/features/messages/`): `templates.ts`
  (defaults in dz/ar/fr/en, `{placeholders}`, `shops.messages` holds only changed texts), `MessageCard` on the order page
  (situation from the status, WhatsApp/SMS links from the agent's phone, logged as an order event "message"),
  `MessagesEditor` on Call Centers → settings.
- AI landing pages v2 (Phase 15): extra photos in the wizard (vision sees up to 10; every image used once), sections
  `imageText` (photo + text, sides alternate) and `benefits` (icon cards). Photos are never cropped (`Photo` in
  `landing/blocks.tsx`: `object-contain`, natural height; galleries too). Image rework = `startImageTask` (image_generation
  tool via `startBackgroundImage`/`pollBackgroundImage`, styles in `enums.ts` `imageStyles`, counted in `maxAiPerMonth`):
  during generation for the first 1–2 `/uploads/` photos (the generation's `result` holds `{imageTasks, applied}`;
  `finishImages` swaps the new URLs into the page and puts them first in the product images; failures keep the original),
  and from the editor's image picker (`EnhanceImage`). E2E: `phase15.mjs`.
- Owner feedback round (phase16.mjs): a shop whose owner is the platform admin has no plan limits (`isPlatformShop` in
  `limits.ts`, every limit -1, custom domain allowed, Plans page shows "platform store"). Agents never get store links.
  Distribution: `team/distribution.ts` (`distributionBoard` per agent load, `spreadOrders` = same fewest-open-orders rule),
  shown on Call Centers → team (`DistributionBoard`, "share now" for unassigned orders); the orders list has a bulk bar
  (`orders/BulkAssign.tsx`: row checkboxes `data-bulk-order`, assign / unassign / share between agents). Google Sheets script
  v2 (`SCRIPT_VERSION`): uses the first empty tab renamed "Orders", answers its version; "Test" writes a visible TEST row and
  asks for the new script when the copy is older. The database is converted to utf8mb4 at startup (`migrate-lib.mjs`).
- Image landing pages (Wibi style, phase17.mjs): sections `poster` (a designed image with its text inside; texts, kind,
  scene + look kept to regenerate, `previous` = images to restore; empty image = hidden on the public page, placeholder in
  the editor) and `marquee` (scrolling band, CSS in globals.css). `landing/posters.ts`: plan prompt/schema
  (`buildPosterPlanRequest`, kinds hero/problem/solution/benefits/features/howto/beforeAfter/details/offer/cta, honesty
  rules, short texts), `finishPosterPage` (band, images, form after the first one), `posterPrompt` (exact quoted texts,
  same product from the reference photos, 1024x1536). `startPosterTask` (ai/tasks.ts, references = our uploads) per section,
  started when the plan is ready; `finishImages` puts each image in its section (`sectionId`) and reports done/total.
  Editor: `PosterFields` (texts, regenerate panel: background, instructions, own full prompt, current image as reference →
  `startPosterImage`; restore; own upload). `LandingSections` draws image pages as one 520px column (`isImagePage`).
  Wizard (`NewLanding.tsx`): AI / manual toggle, page style (images / sections), options, confirmation with the AI cost
  (plan + one per image) against the month's remaining quota; manual image pages use `starterImageSections`.
- Owner feedback round 2 (phase18.mjs): product links go through `src/lib/product-page.ts` (canonical URL — AliExpress
  `/item/<id>.html` —, AliExpress JSON data, anti-bot page → `importBlocked`) and `safeFetch` keeps cookies across redirects.
  Apps sync is a durable outbox: `app_queue` (one row per shop+order) filled by `scheduleOrderSync`, sent by `processQueue`
  right after the response, by "send now" (`sendQueueNow`, makes the shop's rows due) and by the cron URL
  `/api/cron/apps?key=<cronKey()>` (shown on admin → system; add it in cPanel → Cron Jobs every 5 minutes); retries back off
  (`RETRY_MINUTES`) then drop. Image pages: 2/4/6/8/10 images (`posterCounts`); A/B variants were dropped by the owner.
  Performance: only Cairo is preloaded (theme fonts `preload: false`), the first poster / hero / product photo load eagerly
  with `fetchPriority="high"`, AI images are webp with `output_compression` 80. Dashboard fields use the `field` /
  `field-line` tokens (tinted fill on white cards). The public homepage is `src/features/marketing/Home.tsx` (not tied to
  one country). Store home shows `OrderSteps` with the trust badges.
- Owner feedback round 3: Sheets script v4 (`SCRIPT_VERSION`) answers `{sheet, gid, written:[{key,row}]}` → the log says
  "Orders: 1043 → 12" and "Open the sheet" opens `url#gid=`; locked orders are logged (`LOCKED`), never skipped silently; the
  setup steps say to publish a New version after pasting code. Admin → system has the full check (`features/admin/system-check.ts`
  + `ui/CheckCard.tsx`: database, uploads, APP_URL/APP_SECRET, cron backlog > 15 min, AI steps). AI pages follow the owner's
  marketing method (`landing/strategy.ts`: analysis → 3–5 angles from the angle library → persuasion map) or the merchant's own
  prompt in its place (wizard step "method"; `shops.ai_prompt` = saved default); the format/honesty contract always stays.
  Both schemas return `strategy` (audience + angles, saved in `landing_pages.strategy`, `StrategyCard` in the editor) and posters
  carry their `angle`. Storefront form fields use `s-field-edge` / `s-field` (mixed from the theme's text color).
- Owner feedback round 4: persuasion sequence (strategy.ts, both prompts): hero → problem → solution → benefits → features →
  usage → visual proof → objections → trust → offer → order form, at least 5 steps chosen per product; the form is always the
  last step (`finishPosterPage` / `finishLandingPage` push it at the end; sticky button + every poster image links to
  `#order-form`). Posters never contain buttons (no `cta` field any more) and the hero never repeats payment/delivery (the
  band does); poster kinds add `objections` and `trust`. The language switcher is a dropdown (`ui/LanguageSwitcher.tsx`).
- WhatsApp Business API (phase19.mjs): `shop_whatsapp` (phone number ID, encrypted token, a Meta-approved template per
  message situation with its `{{n}}` params mapped to our placeholders) — its own table, never in `shop_apps`/the order sync.
  `messages/whatsapp.ts` (`testWhatsapp`, `sendWhatsapp`: template with `buildMessageVars` values, else plain text — Meta only
  delivers text inside the 24-hour window), actions in `messages/actions.ts` (save/test/disconnect for owners/managers on Apps,
  `sendWhatsappMessage` for anyone who can touch the order → order event "message"). `WhatsappCard` on Apps; `MessageCard`
  shows "Send now" when connected and keeps the wa.me / SMS links. E2E: mock-pixels answers Bearer "wa-good".
- Dashboard `error.tsx` / `not-found.tsx` keep the sidebar and show a friendly message (errors are in error_logs).
- Any server-side fetch of a user URL must go through `src/server/safe-fetch.ts` (product links: `src/server/product-import.ts`).
- The server applies pending migrations at startup (`src/instrumentation-node.ts` → `scripts/migrate-lib.mjs`);
  `/api/health` shows version, DB, migrations and env status.

## Design skill
- `.claude/skills/frontend-design/` (Anthropic's official Frontend Design skill, from github.com/anthropics/claude-plugins-official):
  the creative process for any page — design plan (4–6 named colors, type, layout, principles), review it against generic
  defaults, build, then critique with screenshots. UI/UX Pro Max below supplies the data and rules.
- `.claude/skills/ui-ux-pro-max/` (UI/UX Pro Max, MIT, from github.com/nextlevelbuilder/ui-ux-pro-max-skill): use it for any UI
  work. Search: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <product|style|color|typography|ux|chart> -n 3`
  (or `--design-system` for a full proposal). Keep the project's own tokens (globals.css, `s-*` storefront colors) as the source.
- The platform's design system is `design-system/scaleitto/MASTER.md` (tokens, type, components, checklist): read it before UI
  work. ayor.ai is the owner's visual reference. Interface font = IBM Plex Sans Arabic (`src/app/ui-font.ts`, `--font-ui`, [lang] layout
  only); primary violet #4f3bd6 (`accent`), #7c6cf2 (`accent-bright`) for indicators only, `ink` #080529 for marketing buttons and
  headings, `warning` = attention orange; sidebar `sidebar` (deep indigo).
  Tables inside the shell (`[data-shell]`) get their head/rows/tabular numbers from globals.css; selects use `select-chevron`.
- Storefront/landing rules: `design-system/scaleitto/pages/storefront.md`. On the merchant's color use `text-brand-fg` (never
  text-white) and for the color as text `text-brand-ink` (set by `brandVars` in themes.ts from `src/lib/contrast.ts`).
  Benefit icons are Lucide names from `landing/icons.ts` (AI schema enum; older emoji still shown).

## Testing (required before pushing every section)
- `npm test` — unit tests in `tests/unit/` (node test runner via tsx).
- `npm run test:e2e` — Playwright flows in `tests/e2e/phaseN.mjs` against a running server (E2E_URL, default
  localhost:3000) with the DB from `.env`; also fails if any error is logged in `error_logs` during the run.
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
v2 rebuild order (sidebar): Phase 0 done (foundation, dark shell, auth, roles, profile), Phase 1 done (Products), Phase 2 done (Orders + storefront checkout, fake-order protection, abandoned carts), Phase 3 done (Delivery), Phase 4 done (Store Design), Phase 5 done (Theme Store), Phase 6 done (Call Centers), Phase 7 done (Landing Pages + AI + embeddable form), Phase 8 done (Analytics), Phase 9 done (Pixels: Meta, TikTok, GA4, GTM + server events), Phase 10 done (Apps: Google Sheets/Ecomanager, webhook, Shopify/YouCan import), Phase 11 done (Plans), Phase 12 done (Settings: details, SEO, policies, custom domain), Phase 13 done (platform admin), Phase 14 done (call-center AI: call guide, customer messages, AI descriptions), Phase 15 done (AI landing pages: reworked photos, extra photos, new sections, uncropped mobile-first layout).
Missing features seen in competitors (fraud score, Snapchat pixel, coupons, multi-store, WhatsApp self-confirmation…) are listed
in `docs/next-round.md`: the homepage only claims what exists. Plans (modelled on ayor's, a little cheaper; seeded by
`scripts/migrate-lib.mjs`, missing codes added on start, older codes hidden once): starter (free) / orbit = pay as you go
(`plans.order_pack` = 100 orders for 1,800 DA, no expiry; `shops.order_credits` balance: `orderRule` in limits.ts, `takeOrderSlot`
uses one per order or locks it, top-ups via plan requests where `months` = packs, `releaseLockedOrders` spends the balance) /
rocket 3,500 / galaxy 6,900 a month / "Universe" custom (contact, a contract set by the admin). Labels: `features/plans/labels.ts`.
The homepage (`features/marketing/Home.tsx`, phase20.mjs) highlights `rocket`.
Next: the owner tests image landing pages with a real OpenAI key (image quality / Arabic text), A/B variants of a page; real-account checks of the integrations with the owner's accounts (carriers, pixels, Sheets, OpenAI images) — code reviewed
against public docs/clients; ZR Express new platform added.
The v1 code (main branch) has working versions of most features to consult while rebuilding.
