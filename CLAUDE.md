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
- `src/lib/permissions.ts` — the ONLY place that says which role sees which page (`sections`: key, path, roles) and how
  the sidebar groups them. Since the Zimam parity work (`docs/zimam-parity.md`) the sidebar follows Zimam's layout:
  `navGroups` = main (overview) / sell / grow / storefront / account, each entry a page or a page with sub-pages
  (`navFor(role)`, `entryOf(key)`). `DashboardShell` (white sidebar with the store card, labelled groups, support and the user
  menu; top bar with ⌘K quick search `CommandPalette`, the plan's usage pill, language, visit store, the bell = new orders,
  dark mode = `[data-theme=dark]` on <html> set before paint by `THEME_SCRIPT`). Dashboard colors are `--d-*` variables
  (globals.css; slate + emerald, dark values under `[data-theme=dark]`), fonts Space Grotesk + IBM Plex Sans Arabic.
  Roles: owner / manager / agent (call center).
- Profile (`features/profile`, phase0.mjs) = Zimam's Profile settings: back button, personal information + dashboard language (`users.locale` + `sc_locale` cookie, then the dashboard reopens in it), password in a row that opens, account deletion request (support WhatsApp = PAYMENT_WHATSAPP). No Google/Facebook sign-in yet.
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
- Orders dashboard (`src/features/orders/`): list with status counts/search; an order is edited in Zimam's dialog over the
  list (`?edit=<id>`, `EditOrderDialog`; `/orders/<id>` redirects there). Cancelled/returned orders give stock back (`holdsStock`).
- Delivery (`src/features/delivery/`): `carriers.ts` (catalog; couriers grouped by platform: yalidine, ecotrack —
  one API on <name>.ecotrack.dz for 80+ couriers —, zrexpress = ZR Express's new platform api.zrexpress.app (X-Tenant +
  X-Api-Key, territory UUIDs found by wilaya code / commune name without accents, stop desk = the wilaya's pickup hub), procolis =
  ZR Express's old platform, noest), `platforms/*` (one client per
  platform: test / createParcel / trackingStatus), keys encrypted with `src/server/crypto.ts` (APP_SECRET, falls back
  to DATABASE_URL). Rates per wilaya in `shipping_rates`; sending from the Confirmed tab (`ShipPanel`), tracking from In transit (`TrackPanel`);
  delivered/returned parcels close the order through `src/features/orders/transition.ts` (`applyOrderStatus`, the
  only place that changes an order status: stock + history). E2E tests use `tests/e2e/mock-carriers.mjs` via
  E2E_CARRIER_URL (never set it in production). API formats were taken from open-source clients (CourierDZ, dz-delivery for
  ZR's new platform), not official docs: verify with a real merchant account before relying on a platform. Courier status words
  → `delivery/status.ts` (ZR states pass through `readableState`). Meta Graph API version: `META_VERSION` in
  `src/server/meta.ts` (pixels; Meta retires versions ~2 years after the next one: move it forward yearly).
- Store Design (`src/features/design/`, phase4.mjs) = Zimam's full-screen store builder (`StoreBuilder.tsx` + `BuilderFields.tsx`):
  top bar (back, published state, page picker, add custom page, page settings, desktop/mobile, undo/redo, discard draft, History,
  preview store, publish), icon rail (sections | colors & fonts | pages), Content | Layout tabs, the real store in the middle.
  `shops.design` JSON read through `resolveDesign()` (defaults for missing keys — add new options there). Pages (`builder.ts`, pure):
  `design.pages` = published {home, custom[{id,title,handle,sections}]}, `design.draft` = what the builder edits; sections
  (`storeSectionTypes`: hero, products, collections, badges, steps, text, imageText, faq, video, spacer, each `hidden`-able) always
  read through `sanitizePages` (stores from before the builder get `legacyHome` from hero/showBadges/productsTitle/showOrderSteps).
  Global parts apply at once (`saveStoreDesign` checks `validators.ts globalSchema`): announcement, `navigation` {enabled, links
  [{label, target home|products|page:|collection:|policy:|url:}] → `navHref`}, `header.showPhone`, `footer.enabled`, color, logo,
  style, about, socials. `publishStoreDesign` copies the draft and keeps a copy in `design_versions` (20, migration 0051);
  `discardStoreDraft`, `listDesignHistory` / `getDesignVersion` (restores into the draft). Store home and `/store/<slug>/pages/<handle>`
  render `storefront/sections.tsx StoreSections` with `page-data.ts sectionData`; the builder's preview uses the same component
  (`editing`). The storefront is drawn from `src/features/storefront/blocks.tsx` (plain components shared by the real store and the
  preview — change the look there, not in pages).
- Themes (`src/features/themes/themes.ts`): each theme = tokens (font, surfaces, radii, card style) + layout
  switches (header start/center, hero split/full/card/minimal, columns, image shape, product cards elevated/outline/minimal). `themeStyle()` sets CSS variables on `StoreFrame`; storefront
  code uses only the `s-*` colors (`bg-s-surface`, `text-s-muted`, `border-s-edge` — not `border-s-line`, Tailwind reads that as border-inline-start —…), `rounded-[var(--s-radius)]`,
  `rounded-[var(--s-radius-btn)]` and `shadow-[var(--s-shadow)]` — never fixed slate/white colors, or dark themes
  break. Fonts for all themes are declared once in `src/app/fonts.ts`. The chosen theme is `design.theme`.
  Theme Store page (phase5.mjs) = Zimam's: "Theme Store" header + View storefront, "Browse themes", 4-column cards (live mini
  preview, name, Free, Preview + Install; the active card tinted with "Active theme" + Customize → the builder); keep-my-color is in
  the preview dialog. `applyTheme` only sets `design.theme` (and the color) on the raw JSON.
- Call centers (`src/features/team/`): members are added by owners/managers (one account = one shop; `maxStaff`
  counts active members), with role, work schedule (`WorkSchedule`, Algeria time) and active flag (deactivating
  deletes their sessions and releases their open orders). New orders are assigned in `place-order.ts` via
  `assign.ts → pickAgent` (shops.assign_mode: manual / balanced / on_shift). Agents only see and change orders
  assigned to them: every order query/action goes through `src/features/orders/access.ts` (`visibleOrders`,
  `canTouchOrder`) — keep it that way for new order features. Working time comes from `/api/activity` (heartbeat
  from `ActivityPing`, max one minute per minute) into `member_activity`; `metrics.ts` computes performance
  (confirmations, rates, response time, attendance/punctuality/coverage via `schedule.ts`). Times: `src/lib/time.ts`
  (Africa/Algiers); `formatDate`/`formatTime` always render Algeria time.
- Landing pages (Zimam's builder; `src/features/landing/`): a page = components (`types.ts sectionTypes`: image, text, form,
  sticky, thankYou, countdown, reviews, badges, faq, spacer, bullets, video, announcement — always read through
  `sanitizeSections`, which also turns pre-Zimam blocks into these) in up to three versions: A = `landing_pages.sections`, B/C =
  `variants` (paused ones not shown). The builder (`LandingEditor.tsx`, full screen; `SectionFields.tsx` = the right panel)
  autosaves the draft (`saveLandingDraft`; History entry every few minutes, `landing_versions`), "Publish" copies it into
  `published` (what visitors see), "Discard changes" goes back to it; undo/redo is in the browser. Advanced: slug + `meta_description`,
  `pixels` (per platform, pixel row ids; `pagePixels(shop, products, only)`). Public page `/store/<slug>/lp/<page>`: version from the
  `lpv_<id>` cookie or a random running one (`LandingView` stores it and counts the visit in `landing_stats`), `orders.landing_version`;
  a page with a thankYou component sends the buyer back to `?thanks=<order>` (`ThankYouPopup` + purchase pixels). Blocks drawn by
  `blocks.tsx` (one 520px column, shared with the builder). The form component shows the store's order form
  (`storeForm`). Header = `CreateLanding.tsx` (Zimam: "Create landing page" ↔ "Close" opens the two paths inline; "Design manually" =
  dialog with Existing product (cards + search, `data-pick-product`) | New product (name, price, optional photo → `createLandingPage`
  mode=new creates the active product, `canAdd maxProducts`), then the blank builder). List = `LandingList.tsx` (counters, search, filters, list/grid, row actions: copy link, open,
  versions' numbers `pageVersionStats`, publish/unpublish `setLandingLive`, duplicate, delete).
- AI pages ("Generate with AI", `landing/AiBuilder.tsx` at `/landing-pages/new`): product, language of the texts in the images
  (ar/fr/en), brief (≤ 900), writing framework and style family (`landing/ai-options.ts`), 2/4/6 images, price text, cost = 1 + images
  in `maxAiPerMonth`. `ai-actions.ts startAiLanding` → plan (`posters.ts buildPosterPlanRequest`, honesty rules, short texts) via
  `src/server/ai/openai.ts` (Responses API in background mode; model chain OPENAI_MODEL → gpt-6.1-sol → gpt-6.1-luna → gpt-6-luna),
  the browser polls `checkAiLanding`; `finishPosterPage` = images (texts kept in `image.poster`) + form + sticky + thankYou, then one
  `startPosterTask` per image. "Improve with AI" (`startAiVersion`) returns a new version's components to the builder (added paused).
  Image tools: `startPosterImage` (draw again with corrected texts), `startImageEdit` (AI edit prompt, current image as reference).
  E2E uses `tests/e2e/mock-openai.mjs` (OPENAI_BASE_URL=http://127.0.0.1:4020/v1, OPENAI_API_KEY=sk-test).
- Analytics like Zimam (`src/features/analytics/`, phase8.mjs): `/dashboard/analytics?tab=orders|products|impressions|team&period=`
  (`range.ts` presets today…90d/month, default 7d, Algeria days, previous period of the same length). `queries.ts` loads the
  orders, items, `page_views` and agents once; `compute.ts` (pure, unit-tested) returns each tab: orders (KPIs total/sales/delivery
  rate/avg daily vs the days before, daily bars against the previous period, status ring, funnel, key insights, wilayas, sales and
  delivered/returned lines), products (visitors, orders, order rate, bands excellent ≥ 5% / good ≥ 1% / low, per-product table),
  impressions (impressions, visitors, sources, daily trend switched impressions | visitors with `?trend=`), team (per agent). Charts are
  plain SVG in `charts.tsx` (Zimam's smooth curves = `smoothPath` monotone cubic, `FunnelShape` = the coloured funnel with rate pills);
  tabs in `views.tsx` (rates with one decimal, wilaya names without code `wilayaTitle`, products' "…" actions). Wilaya map =
  `WilayaMap.tsx` + `lib/algeria-map.ts` (69 outlines from geoalgeria, © OpenStreetMap contributors ODbL — attribution under the map,
  `docs/third-party.md`). Store visits: `VisitPing` (store home, product and landing pages) → POST `/api/visit` → `page_views` (per shop, day,
  product, source host; a visitor counted once per day and page key through the `sc_v` cookie; robots skipped; migration 0038).
- Pixels like Zimam (`src/features/pixels/`, phase9.mjs): `/integrations/pixels` = "Pixels & Analytics" grid of 5 apps (GTM, GA4,
  Facebook, Snapchat, TikTok; `PlatformMark.tsx`, active when one of its pixels runs) → `/integrations/pixels/<platform>` = back link,
  info banner, `PixelApp.tsx` (Meta/TikTok/Snapchat: a list of ad accounts, "Add another ad account"; GA4/GTM: one ID; advanced:
  purchaseOn + products) saved at once by `savePlatformPixels` (`validators.ts parseAccounts`, errors keyed `tagId.<i>`; removed
  accounts are deleted with their log), the test button and that platform's server log. `pixels` rows (meta / tiktok / snapchat /
  ga4 / gtm; tag IDs checked by `ids.ts` because they go into inline scripts — Snap IDs are UUIDs; optional encrypted server secret
  + test code; `purchaseOn` placed/confirmed/delivered; `productIds` null = whole store). Browser: `PixelScope` on every storefront page (pages pass `pagePixels(shop, productIds)`) loads only
  that page's pixels and sends events with `track.ts` (Meta trackSingle, TikTok instance, Snap `snaptr` to all its pixels on the page — no Lead, GA4 send_to, GTM dataLayer);
  `CheckoutForm` fires InitiateCheckout via `useCheckoutStarted`; thank-you pages fire Purchase (event id = order id) or
  Lead for pixels waiting for confirmation/delivery. Server: `server.ts` (Conversions API, Events API, Snap Conversions API v3 — test = `/events/validate`, click id `ScCid` → `sc_sccid` cookie —, Measurement Protocol)
  via `scheduleOrderEvents` → `after()`: on placement (`checkout/actions.ts`, ad cookies saved in `orders.tracking`) and on
  confirmed/delivered (`applyOrderStatus`). `pixel_events` = log + unique (pixel, order, event) so nothing is sent twice.
  E2E uses `tests/e2e/mock-pixels.mjs` via E2E_PIXEL_URL (never set it in production).
- Apps like Zimam (phase32.mjs): `/integrations/apps` = "Apps & Integrations" grid (`apps/registry.ts appKeys`: Zimam's 19 apps + our
  webhook; `readyApps` open, the others show "coming"; pill from `settings-queries.ts appStates`) → `/integrations/apps/<app>` = back
  link, "How it works" banner, the app's form (`AppPages.tsx`, actions in `settings-actions.ts`). Settings in `shops.apps` read
  through `apps/settings.ts resolveApps` (migration 0040): `abandoned` (off = `saveLead` keeps no draft), `scanner` (off = Scan
  leaves `navFor`, the Orders toolbar, and /scan redirects), `badges` (payment/returns/guarantee/delivery; storefront
  `TrustBadges` + `trustBadgeItems` under the product form, store home, product preview; returns/guarantee off by default —
  merchant promises), `contact` (floating phone/WhatsApp in `StoreShell`; replaced design.floatingWhatsapp), `thanks` (title,
  message with {phone}, button, redirect home/product on the store thank-you page). Fake OrderGuard = `shops.protection`
  (`enabled` off: only the blacklist is checked, no risk score/bot refusal; `duplicateHours` = Zimam's protection period, 1–720 h with
  "Custom", counts the per-number limit and repeats; checkout captcha `captcha` never / always / risky + `captchaFallback` accept /
  refuse = Cloudflare Turnstile with the platform's TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY: `server/turnstile.ts verifyTurnstile`
  in `placeCartOrder` (errors captcha / captchaDown), `storeCaptcha` → `TurnstileBox` in CheckoutForm / CartPage (risky: shown after a
  "captcha" refusal); E2E_TURNSTILE_URL = mock-apps siteverify, phase37.mjs), Agent auto assign = `shops.assign_mode`, Blacklist =
  `blocked_phones` + `protection.blockedIps`, QR codes (`qrcode`, made in the browser), Product import, Webhook (+ the send log).
  Order tracking (`tracking`: private link `/store/<slug>/track?o=&k=` with `crypto.ts orderToken`, lookup by phone or number+phone,
  `storefront/tracking.ts` + `TrackOrder.tsx`, rate-limited lookups, contact = `trackingContact`). Promotions (`promotions` table,
  `features/promotions`: pure `pricing.ts promoted/discounted`, `apply.ts withPromotions` used by every store product loader and
  `placeCartOrder`; offers and wholesale tiers drop by the same %; Algeria local times). Collections (`collections` table +
  `products.collection_ids`, `features/collections`, store `/collections/<handle>` + strip on the home, product form checklist).
  Rules (`apps/rules.ts`, pure, in `shops.apps`): `deliveryRules` (first match → `orders.carrier_account_id` when the product has
  none) and `agentRules` (product / wilaya / source / hours → `pickAgent` gives the order to the matching agents, any mode).
  Custom fields (`customFields` switch + `products.custom_fields`, merged into the store form by `order-form/resolve.ts productForm`,
  ids `p-…`, checked in `submitOrder`). Wholesale (`wholesale` switch + `products.wholesale` {minQty, tiers}, `checkout/pricing.ts
  resolveWholesale / linePrice(…, wholesale)`, up to 1000 pieces, product editor tab). Shopping cart (`cart` switch; browser cart
  `storefront/cart.ts` per shop, `CartLink` in the header, `/store/<slug>/cart` = `CartPage` + `cart-actions.ts priceCart/submitCart`;
  `place-order.ts placeCartOrder` = one order with several lines — `placeOrder` is its one-line case).
  Online payments (`features/payments`, phase33.mjs; owner: Stripe, PayPal, CIB, Edahabia — Chargily/SlickPay removed, migration
  0049): `methods.ts` = four independent methods × connectors (the provider / official infrastructure that processes each:
  stripe → Stripe Checkout, paypal → PayPal Orders v2 (EUR/USD at the merchant's rate), cib → SATIM, edahabia → SATIM or
  `algerie_poste` = listed `ready: false`, no public merchant API). Clients in `connectors/*` (test / start / status; SATIM REST
  register.do → getOrderStatusExtended.do / confirmOrder.do, centimes, currency 012). `shop_payment_methods` (one row per shop +
  method, connector, keys encrypted, test/live, `checked_at`). `flow.ts liveMethods` = active + tested + ready connector — the only
  methods buyers see (`PaymentChoice`, radio `payment` = cod or a method) and the only ones shown active on Apps → Online payments
  (`PaymentsApp.tsx`, one card per method). Order → `startOnlinePayment` → payment page → `/thanks?o=&paid=` where `refreshPayment`
  asks the connector (after `connection()`); a failed start keeps the order cash on delivery. Orders filter `?payment=cod|<method>`.
  Formats from the public API docs (Stripe, PayPal) and the satim-node client: verify with real accounts. E2E: `mock-pixels.mjs`
  fakes the three connectors with a `/pay/<id>` page (E2E_PAYMENT_URL, never in production).
  Balance (`features/credits`, `/dashboard/balance`, owner): `shops.credits` + `credit_ledger` (every +/− with the balance after;
  kinds trial / subscription / purchase / admin / whatsapp / notification / refund / ai), `ledger.ts grantCredits / spendCredits`
  (atomic, refuses when short). New stores get `TRIAL_CREDITS` (500, migration 0046 gave every store 500). Packs in `packs.ts`
  (DZD prices); bought online through the platform's own methods (`credits/purchases.ts platformMethods`: PLATFORM_STRIPE_SECRET,
  PLATFORM_PAYPAL_CLIENT_ID/_SECRET/_RATE, PLATFORM_SATIM_USER/_PASSWORD/_TERMINAL for CIB + Edahabia, PLATFORM_PAYMENT_MODE;
  return `?purchase=` → `refreshCreditPurchase`) or locally (CCP/RIB receipt or WhatsApp → `credit_purchases` pending →
  admin → plan requests page approves → `approveCreditPurchase`, credits once).
  WhatsApp confirmation (phase34.mjs, `features/whatsapp`, migration 0047): settings `shops.apps.whatsapp` (`resolveApps`:
  enabled, quiet hours, reminder, language, products, `notify` per `waNotices`, connectRequested). `whatsapp_messages` = outbox +
  log (unique order+kind); `queue.ts scheduleWhatsApp` (placement in checkout/cart/channels: confirm; `applyOrderStatus`:
  confirmed/shipped/delivered; `trackShipment` stage → `stageNotice`) → `processWhatsApp` (claim, skip, quiet hours, `spendCredits`,
  `cloud.ts sendTemplate`, refund on refusal); cron also `queueReminders` (4 h unread). Webhook `/api/whatsapp` (verify token,
  X-Hub-Signature-256): reports (failed → refund) and button replies → `orders.whatsapp` (waiting/confirmed/cancelled) = the
  `?wa=` filter under the status tabs + row badge. Platform env WHATSAPP_TOKEN/_PHONE_ID/_APP_SECRET/_VERIFY_TOKEN; templates in
  `docs/whatsapp.md`; E2E: mock-pixels `/meta/<v>/<phone>/messages` (numbers ending 0000 refused).
- Apps sync (`src/features/apps/`): `shop_apps` (google_sheets / webhook; merchant URL + encrypted secret, one per kind) and the
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
  Plans page = Zimam's "Subscription & Billing" (phase39.mjs): credit balance pill, current plan + usage, Invoices (requests), "Choose
  your subscription term" = payment method (online = the platform's own methods `billing.ts onlinePlanMethods` → `requestPlanOnline`
  → `startPlanPayment` → back to `?request=` → `refreshPlanPayment` approves at once; `plan_requests.method` "online" + `provider_ref`,
  migration 0053 | local = the CCP/RIB/WhatsApp request form) and the prepaid term (`terms.ts`: 1/3/6/12 months, −0/5/10/25%,
  `planAmount`; packs of pay-as-you-go plans get no term discount), plan cards (✓ limits, custom domain ✓/✗, included integrations /
  features chips, "Most popular" = rocket, free plan = greyed button), Balance card, Feature packs (`packs.ts quotaPacks`: 500 orders
  1,500 credits, 20 AI pages 400 credits → `buyQuotaPack` spends credits, `quota_packs` rows for the Algeria month are added to the
  monthly limits in `getEffectiveLimits`, `packMonth`).
- Settings (`src/features/settings/`, phase12.mjs) = Zimam's Store settings with underline tabs (`?tab=`): General (name, description =
  `design.about`, location = `design.location`, Instagram / TikTok / Facebook / Telegram usernames → `design.socials` links, phone; the
  device notifications card = browser permission + new-order sound/volume kept in localStorage `shell/alerts.ts`, played by
  `shell/OrderAlerts.tsx` polling `/api/orders/latest` every 30 s in the dashboard and the agents' portal; Google & sharing), Domain
  (store link `saveSlug`, custom domain, SSL, help), Language (`saveStoreLanguage`, at once), Checkout (`order_form.name` / `commune` /
  `address` hidden|optional|required, delivery hidden = one type; phone + wilaya always required; checked by `checkout/validators.ts
  checkContact` in `submitOrder` / `submitCart`), Product page (`order_form.optionButtons`; otherwise a text option with > 6 values or a
  value > 18 characters is a dropdown in `CheckoutForm`), MCP, Refer a seller (phase12.mjs + phase38.mjs). The wilaya can be optional
  (`order_form.wilaya`; an order without one = `wilaya_code` 0, shipping 0 until the team completes it, `sendParcel` refuses
  `wilayaMissing`, `wilayaName(0)` = "—"). Sounds: `shell/alerts.ts` (Zimam's list, "system" = none of ours) for new orders and
  other notifications (a new abandoned checkout, `/api/orders/latest` → `abandoned`). SEO (home page settings = the builder's gear,
  `design/actions.ts saveHomeSeo`) and policy pages (builder → Pages panel, `savePolicyPage`) moved to Store Design (`PageExtras.tsx`).
  Domain → Allowed origins (`shops.api_origins`, migration 0052) = the public store API `/api/storefront/v1/<store id>/products |
  products/<slug> | shipping | orders` (`features/storefront/api.ts`: CORS only for allowed origins, server calls accepted; orders go
  through `checkContact` + `placeOrder`; docs/storefront-api.md). MCP (`features/mcp`: `mcp_tokens` sha256 + scopes from `scopes.ts`,
  `tools.ts` = list/get orders, products, sales_summary, delivery_status, update_order_status, create_order, create/update_product,
  send_to_carrier) served by POST `/api/mcp` (JSON-RPC: initialize records the client = "connected apps", tools/list by scope,
  tools/call); tokens shown once, revocable one by one or per client. Refer a seller (`features/referrals`): `/r/<slug>` → cookie
  `sc_ref` (relative redirect to /<lang>/register) → `recordReferral` at sign-up (`shops.referred_by` + a pending
  `referral_vouchers` row); `approvePlanRequest` → `settleReferral` (voucher available with the referred plan's price, or used when
  the request carried it); `requestPlan` takes `referralDiscount` off (`plan_requests.discount` / `voucher_id`; 10% of a referred
  store's first payment + half a month of the lower price; `discount.ts previewDiscount` shows it on the Plans page). Older notes:
  store details (name, phone, store language, link — `shopSlugSchema` shared with
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
- Small AI tasks (`src/features/ai/`): `tasks.ts` (`startTask` → background request + an `ai_generations` row with `kind`,
  counted in `maxAiPerMonth`; `pollTask` → clean, save, return `result`), browser hook `useAiTask`; `prompts.ts` = the product
  `description` (fills the product form). The call guide, customer messages and the WhatsApp Business API were removed (owner:
  like Zimam; migration 0037, which also drops products.cost_price).
- Owner feedback round (phase16.mjs): a shop whose owner is the platform admin has no plan limits (`isPlatformShop` in
  `limits.ts`, every limit -1, custom domain allowed, Plans page shows "platform store"). Agents never get store links.
  New orders go to agents by `shops.assign_mode` (`team/assign.ts`). Google Sheets script
  v2 (`SCRIPT_VERSION`): uses the first empty tab renamed "Orders", answers its version; "Test" writes a visible TEST row and
  asks for the new script when the copy is older. The database is converted to utf8mb4 at startup (`migrate-lib.mjs`).
- Owner feedback round 2 (phase18.mjs): product links go through `src/lib/product-page.ts` (canonical URL — AliExpress
  `/item/<id>.html` —, AliExpress JSON data, anti-bot page → `importBlocked`) and `safeFetch` keeps cookies across redirects.
  Apps sync is a durable outbox: `app_queue` (one row per shop+order) filled by `scheduleOrderSync`, sent by `processQueue`
  right after the response, by "send now" (`sendQueueNow`, makes the shop's rows due) and by the cron URL
  `/api/cron/apps?key=<cronKey()>` (shown on admin → system; add it in cPanel → Cron Jobs every 5 minutes); retries back off
  (`RETRY_MINUTES`) then drop.
  Performance: only Cairo is preloaded (theme fonts `preload: false`), the first landing image / hero / product photo load eagerly
  with `fetchPriority="high"`, AI images are webp with `output_compression` 80. Dashboard fields use the `field` /
  `field-line` tokens (tinted fill on white cards). The public homepage is `src/features/marketing/Home.tsx` (not tied to
  one country). Store home shows `OrderSteps` with the trust badges.
- Owner feedback round 3: Sheets script v4 (`SCRIPT_VERSION`) answers `{sheet, gid, written:[{key,row}]}` → the log says
  "Orders: 1043 → 12" and "Open the sheet" opens `url#gid=`; locked orders are logged (`LOCKED`), never skipped silently; the
  setup steps say to publish a New version after pasting code. Admin → system has the full check (`features/admin/system-check.ts`
  + `ui/CheckCard.tsx`: database, uploads, APP_URL/APP_SECRET, cron backlog > 15 min, AI steps). Storefront form fields use `s-field-edge` / `s-field` (mixed from the theme's text color).
- Owner feedback round 4: AI images never contain buttons (every landing image links to `#order-form`). The language switcher is a dropdown (`ui/LanguageSwitcher.tsx`).
- Owner feedback round 5 (phase21.mjs) — Orders organised in sub-sections (`orders/views.ts`: all / confirm / ship (confirmed) /
  transit (shipped, chips per courier stage) / done / risk, plus Abandoned and Protection pages; filters wilaya, delivery type,
  dates, agent, page size) with selection tools (`OrderTools.tsx`: select all/none/invert, `ShipPanel` = bulk send one order per
  request with progress, stop, report and "retry the failed", `TrackPanel` = bulk stage refresh). Shipment stages follow the
  Ecotrack/Packers screen (`shipmentStatuses`: ready, pickup, to_station, at_station, to_wilaya, preparing, out_for_delivery,
  suspended, delivered, returning, returned, cancelled, deleted, to_delete; mapping in `delivery/status.ts`). Parcel options
  (`lib/enums.ts` ParcelOptions: type delivery/exchange/pickup/recovery = Ecotrack `type` 1–4, stop desk, fragile → "FRAGILE"
  in the note, weight, phone 2 → `telephone_2`, item to collect → `produit_a_recupere`, map link, product wording; field names
  from the CourierDZ client) built by `delivery/parcel.ts` (`buildParcel`, `parseParcelOptions`), defaults per company in
  `carrier_accounts.options`. Packers import sheet = `delivery/packers-sheet.ts` (the owner's 18-column model, CSV with BOM) via
  POST `/api/orders/packers-sheet`; labels via `/api/shipments/<id>/label` (Ecotrack PDF fetched with the shop's token).
  `delivery/tracking.ts`: `trackShipment` (button, bulk) and `trackDueShipments` (the same cron URL as the apps queue, every
  parcel every 3 h). Fake orders: `checkout/protection.ts` (store settings `shops.protection` via `resolveProtection`: limits,
  duplicates, min fill seconds, block bots, risk threshold, hold suspicious, network) + `checkout/risk.ts` (pure `scoreOrder`:
  returns/cancels of the phone, returns in other stores, fill time from `CheckoutForm`'s `fill` field (missing = no JavaScript),
  robot user agent, fake name, many phones from one IP; delivered orders lower it) → `orders.risk` / `risk_reasons`, event "risk";
  obvious robots refused (error "bot"), suspicious orders held from agents when the store says so; the table shows a risk badge. E2E browsers use `BROWSER_ARGS` (a normal Chrome user agent: "HeadlessChrome" is refused).
- Owner feedback round 6 (phase22.mjs): accounts — register asks the phone (required) and the store language, the link
  preview shows the platform domain (`storeLinkParts`), owners confirm their email (`auth_tokens` verify/reset,
  `server/mail.ts`: SMTP_* env or E2E_MAIL_URL = mock-apps `/mail`; no mail settings → accounts count as confirmed), forgot/reset
  password; `requireShop` sends unconfirmed owners to `/[lang]/verify`; PLATFORM_ADMIN_EMAIL is promoted at login too. Communes:
  `lib/communes.ts` (1541, [latin, arabic], grouped by the 69 wilayas) via `/api/communes?w=` → `checkout/CommuneSelect.tsx` (value = Latin name, Arabic
  label in Arabic stores; give it key={wilaya}). Product color options: `ProductOption.kind = "color"` + `colors` (value → hex),
  palette in `lib/colors.ts`, swatches in `CheckoutForm`. The order form is the store's
  `shops.order_form` (`FormSettings` read by `order-form/resolve.ts storeForm`; product pages, landing pages, `submitOrder`, thank-you;
  popup forms answer every `#order-form` link); its editing page was removed in the Zimam cleanup (Zimam: Store settings → Checkout). Store design
  `style` overrides the theme (font, header, hero, columns, image, cards, corners) through `storeTheme(design)` — use it instead of
  `findTheme` for storefront pages —, plus `showOrderSteps` and `floatingWhatsapp`. Logo: `ui/Logo.tsx`, `app/icon.svg`. The
  audit of what is still missing is `docs/next-round.md`.
- Owner feedback round 7 (phase23.mjs): pages moved under groups (`/integrations/pixels|apps`, `/store-design/themes`, old URLs
  redirect in next.config.ts); the admin area has "back to the dashboard" (`backLink`). Order analysis (`analytics/insights-math.ts`, pure). Order form settings: custom field types
  (text, textarea, number, email, date, select, radio, checkbox — `customFieldValid` on the server), `blocks`, `stepper`.
- Offers (`QuantityOffer`, round 8): freeShipping (`lineShipping`), gift (written into the order line's `offer_label`), badge
  (`offerBadges`), preselected (`defaultQuantity`), quick templates (`offerTemplate`); offer cards in `CheckoutForm`. Fake-order
  protection runs from the store's saved settings (`shops.protection`, `resolveProtection`; no page since the Zimam cleanup).
- Zimam parity phase 2 (phase26.mjs) — replaces rounds 8/9's order model: statuses (`orders/statuses.ts`) pending, call_back,
  confirmed, in_transit, delivered, returned, abandoned (checkout left: `place-order.ts saveAbandoned`, a draft order with the
  status "abandoned"; the real order takes its number), cancelled, flagged (fake; autoBlockFakePhone). Orders page
  (`orders/OrdersPage.tsx`, no page title like Zimam): colored status cards (pending also lists call_back), toolbar (`OrderToolbar.tsx`
  filter dialog, export `/api/orders/export` | refresh, search, scan link, `NewOrderButton`), bulk status when rows are ticked, `OrdersTable.tsx` edited in place
  (`updateOrderField`, `changeOrderStatus`; risk badge), ShipPanel in Confirmed, TrackPanel in In transit. The order
  dialog (`?edit=<id>`, `EditOrderDialog` in `OrderForm.tsx`; `saveOrder`: lines, customer, delivery, fee from the rates or
  waived, status, agent; closes on save) — Zimam's form only. Scan (`/dashboard/scan`, `delivery/ScanPanel.tsx` = banner with the mode switch, one large field, results; `scanParcel`): dispatch
  confirmed → in transit, recuperate → returned + `return_received_at`. Home = `analytics/overview.ts overviewData`. Old
  sub-pages redirect to tabs (next.config.ts).
- Zimam parity phase 3 (phase27.mjs) — products: `ProductForm.tsx` = tabs (details / description / variants & stock / checkout &
  delivery / offers; panels stay in the DOM with `hidden`, `data-form-tab` / `data-panel`, a failed save opens the first tab with an
  error), `ProductPreview`, sticky actions (clear, "create & add another" = submit `intent=another` → `/products/new?created=<id>`,
  the page keys the form on it; `useActionForm` passes the submitter). New columns: `short_description` (≤ 7 words),
  `description_images`, `low_stock` (the product's alert threshold), `show_out_of_stock` (off = sold-out
  products leave store lists: `storefront/queries.ts inStock`), `carrier_account_id` (copied to new orders in `place-order.ts`),
  `similar_ids` (null = automatic; `similarProducts` under the product page). Editor props from `products/editor-props.ts`.
  List (Zimam's: no tabs or search) columns: current/old price, published, stock, units sold, status, actions = open in store /
  edit / delete. Form header = square back button; underline tabs; each tab one card with icon headings (Zimam). Description =
  `AiDescriptionBox` (key selling points → AI text as rich text) + `ui/RichTextEditor.tsx` (toolbar: bold, italic, underline, strike,
  H2/H3, lists, quote, align, link, undo/redo); descriptions are clean HTML via `lib/rich-text.ts` (`cleanRichText` allowlist on
  save, `descriptionHtml` on the storefront — older plain text becomes paragraphs; `richTextToPlain` for AI/meta). Offers =
  "Upsell offers" switch + similar-products checklist (all ticked = null = automatic; Select all / Clear all). Live preview =
  `ProductPreview.tsx`: the real product page (store language, theme, color, `CheckoutForm` inert, description, badges, footer)
  in a scrolling phone; data from `editor-props.ts preview`. The form sets `data-ready` once hydrated (e2e waits for it).
- Zimam parity round 2 (owner: "every detail like Zimam", phase35.mjs). Overview: period dropdown (today, yesterday, 7d, 30d,
  this/last month = `analytics/range.ts` presets incl. `lastMonth`) and chart range dropdown (`ui/LinkMenu.tsx`), chart with side
  amounts, a dot per day and a % badge, last week's orders under the tasks; every dashboard page ends with "Help for this page"
  (the support link). Page headers have no divider. Products: the live preview is a fixed phone (280/320 × 560/640 screen,
  scrolls inside) and the storefront blocks + CheckoutForm use container queries (`@container` on `StoreFrame`, `@min-[40rem]:`
  instead of `sm:`…) so the preview and Design's mobile view show the real phone layout. Variants = Zimam's editor
  (`products/VariantsEditor.tsx`): up to 3 variants (color / size / custom), display `text | color | text_color | image`
  (`ProductOption.display`, older `kind: "color"` read by `displayOf`), per-value color/photo and on/off (`off`), `optional`
  (not a combination: the buyer's choice goes to the order's `extra` via the form's `choices` field, `optionalChoices`) and
  `hidden`; 30 values, 150 combinations; combinations keep price, old price (`product_variants.compare_at_price`), SKU, stock and
  `active`. The store only gets `variants.ts offered()` combinations. Products also have `max_per_order` (store orders only,
  checked in `placeCartOrder`), `delivery_option` (the store's delivery option id → `getShippingRates(shop, option)` /
  `delivery/settings.ts limitToOption`) and `card_only` (online payment only: COD refused in `submitOrder`/`submitCart`, no
  gateway = cannot be ordered). Offers = Zimam's rows (★ default, text, quantity from 1, total price, free delivery, on/off
  `QuantityOffer.off`, reorder); switched-off offers are dropped in `withPromotions` (every store loader). Migration 0048.
  Orders: Zimam's row (green number, date / time lines, bordered amount / type / agent / company fields, status pill with its icon,
  +213 phone with WhatsApp, wilaya name only), no paging bar under one page, tables have no head band; filter dialog (product +
  agent, payment `?payment=cod|card`, wilaya, date range); edit dialog = main product photo, delivery type dropdown, one-line note,
  "Myself" for the signed-in member, customer tracking link (`trackLink`); new order = one column, delivery cards, no agent / company
  / fee / address (the server prices delivery).
- Zimam parity phase 4 (phase28.mjs) — delivery (Zimam layout: underline section tabs from the shell, no page header): sections
  `delivery` (compact `AutoSendSwitch`, title, connected accounts when any, `CarrierCatalog` with search and wide "Integrate" cards that open
  the company's page `/delivery/carriers/<key>` = `CarrierSetup`: back, mark, connection form "Save connection" → back to the list with
  `?connected=`, "Delete connection", the company's parcel defaults; companies without a verified API (Maystro, E-COM, Aligoo, DCH,
  OSEN, Zimou — `platform: null`) say "coming soon"; uften/courier (MIT) has unverified Maystro / Zimou adapters to start from), `manifest`
  (`delivery/manifest`, `ManifestEditor` + shared `Manifest.tsx` with its own ar/fr/en labels) and `deliverySettings`
  (`delivery/settings`: `DeliverySettingsForm`; `/delivery/rates` redirects; page tabs ordered by `permissions.ts tabOrder` = General
  settings first, like Zimam). `delivery/settings.ts` (pure): `shops.delivery` via `resolveDelivery` (enabled, autoSend, up to 10
  methods: name, type home / office / both, pricing free / flat (home + office prices) / wilaya (`rates` per wilaya: paid with home +
  office price, free, none; unset = not delivered; `rates: null` = older methods reading the shared `shipping_rates` table), active,
  one `isDefault`) and `applyDelivery(table, settings, productOption)` (no methods = the shared table; else per type the first active
  method that prices it, the preferred one first; a product's method alone), inside `getShippingRates` — so every form, order and
  the order dialog follow it (off = free). Editor = Zimam's: method cards, `OptionEditor` (choice cards, wilaya table with selection
  and bulk home / office / free / none), enable switch saved at once; an older store's table shows as a method to save
  (`optionFromTable`) and is kept as a method when the first one is added;
  `shops.manifest` via `resolveManifest` (draft + published). Sending lives in `delivery/send.ts` (`sendParcel`, used by
  `sendToCarrier`; `scheduleAutoSend` from `applyOrderStatus` on confirmed: orders with `carrier_account_id`, a refusal becomes
  an order note "⚠ …"). Printing: `/[lang]/print/manifest?ids=` (published template or default) opened by `ManifestButton`.
- Zimam parity phase 5 (phase29.mjs) — Connected platforms (`channels` section, `/dashboard/channels` = Zimam's grid of 7 cards,
  `channels/ChannelGrid.tsx`; each "Connect" opens `/dashboard/channels/<google_sheets|shopify|woocommerce>` with the setup card;
  LightFunnels/Orderdz/Storeep/YouCan shown as coming): Google Sheets (moved from Apps) + `shop_channels` (shopify / woocommerce: random `token`,
  encrypted secret). Set up automatically like Zimam (`channels/platforms.ts`, through `safe-fetch.ts safeRequest`): Shopify = store
  address + Admin API token + app secret key → `shopifySetup` checks /shop.json and creates the orders/create webhook (`SHOPIFY_VERSION`,
  move it forward yearly; secret never shown back); WooCommerce = store address → "Connect to WooCommerce" redirects to
  `wooAuthorizeUrl` (/wc-auth/v1/authorize, user_id = channel token) → the store POSTs the REST keys to `/api/channels/woo-auth` →
  `wooCreateWebhook` (order.created, signed with our secret). `shop_channels.settings` = { webhookId } | { pending } | { error } — a
  refusal shows the manual steps with the address and secret. E2E: mock-apps `/shopify-admin/…`, `/woo` (`/woo-bad` refuses). Platforms POST to `/api/channels/<token>`, signed
  (base64 HMAC-SHA256: X-Shopify-Hmac-Sha256 / X-WC-Webhook-Signature); `channels/parse.ts` (pure: `parseShopify`, `parseWoo`,
  `wilayaFrom`, `validSignature`) and `channels/receive.ts` (`receiveOrder`: `orders.external_ref` unique per shop + `orders.channel`,
  lines matched by SKU then name, no stock taken, plan slot, agent, sync). Google Sheets page = tabs Import | Export (`?tab=export` =
  the Apps export card). Import (phase36.mjs, migration 0050: `shop_channels.kind` google_sheets + `settings` json): `channels/sheets.ts`
  (pure: `splitHeaders`, `detectColumns` ar/fr/en hints, `resolveSheetImport`, `parseSheetRow` → ref `google_sheets:<sheet>:<row>`,
  `sheetsImportScript` = Apps Script with setup() trigger every minute, rows signed base64 HMAC in X-Scaleitto-Signature, status
  column marks sent rows, doPost writes statuses checked by `?signature=`), `SheetsImport.tsx`, `saveSheetImport` (script URL must be
  script.google.com/macros/s/…/exec, or E2E_APPS_URL in tests). Rows → `receiveOrder(…, { storePrices })` (empty price = product
  price by name, home delivery from the store) → answer "#1042 · status"; `applyOrderStatus` → `sheets-sync.ts scheduleSheetStatus`
  posts the new status back to the row. Team (`team` section): `member_invites` (sha256 of the
  token, 7 days), `team/invites.ts` (`inviteMember` emails the link and returns it, `staffUsage` = active members + pending
  invitations vs `maxStaff`, `cancelInvite`, `acceptInvite` → account + membership + session), `/[lang]/invite/<token>`. Team page like Zimam
  (`TeamInvites`: title + teammates counter above "+ Invite"; the owner is neither listed nor counted — shown as used − 1 / maxStaff − 1;
  "Active" list with remove = `removeMember`; pending invitations).
- Call center like Zimam (phase31.mjs): agents have `shop_members.username` (unique per shop) and sign in at
  `/[lang]/call-center/login` (store slug or domain + username or email + password, `team/portal.ts agentLogin`); the portal
  (`app/[lang]/call-center/(portal)`, `requireAgent`) reuses `DashboardShell` (`logoutInNav`) with Dashboard (`team/agent-overview.ts`
  + pure `agent-stats.ts`, `AgentDashboard.tsx`) and Orders (`OrdersPage portal`, the same edit dialog). Agents reach no dashboard
  page: `requireSection` sends them to the portal (only order actions accept them); dashboard order URLs redirect there.
  Owner page = `TeamManager` (Zimam's agent cards: headset mark + online dot, name, @username, email, round buttons edit (role,
  schedule, reset password, deactivate) / copy sign-in details / open the portal / delete = `removeMember` (membership + sessions
  gone, open orders released, account kept for history), footer "created" + presence; `AddAgentDialog` = Zimam's wide dialog,
  username + password side by side: email optional → internal `@agents.invalid` address, hidden).
- Zimam cleanup: Inventory, Finance, the call-center tabs (performance, activity, distribution, customer messages editor), the
  Protection page, the Order form page (with form templates) and the embeddable form were removed (owner's choice: not in
  Zimam; migration 0036). The overview is Zimam's (`analytics/overview.ts`: period today/7d/30d, previous period, tasks with
  minutes, line chart 7/30 days, best sellers, latest orders, four set-up steps; `OverviewControls.tsx` hides amounts).
- Dashboard `error.tsx` / `not-found.tsx` keep the sidebar and show a friendly message (errors are in error_logs).
- Security (audit Nov 2026 with `.claude/skills/security-audit/`, Cloudflare's skill, MIT; summary `docs/security-audit.md`): the visitor's
  IP only through `src/server/client-ip.ts clientIp` (last X-Forwarded-For entry = the one the proxy wrote; TRUSTED_PROXY_HOPS,
  CLIENT_IP_HEADER) — never `x-forwarded-for.split(",")[0]`. Guessing limits in `src/server/rate-limit.ts` (memory): sign-in and the
  agents' sign-in count failed passwords (10 per account, 50 per IP / 15 min, `tooManyAttempts`), forgot password 3 per address / 10 per
  IP an hour, sign-up 20 per IP an hour, the profile's current password 10 / 15 min, tracking lookups 20 per IP an hour. A password
  change ends the user's other sessions (`endOtherSessions`).
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
- `.claude/skills/taste-skill/` (Taste Skill v2, MIT, from github.com/Leonxlnx/taste-skill): the no-slop house style and its real-browser
  meter. Pages: `node .claude/skills/taste-skill/scripts/inspect.mjs <url> --allow palette-purple` (violet is the brand, kept on
  purpose); app screens add `--app` (rules in its `references/app-screens.md`). As root in this container Chrome needs a wrapper that adds
  `--no-sandbox` (CHROME_PATH); dashboard pages need a signed-in relay. Applied Nov 2026: the homepage has no gradients, glows, stars, eyebrows,
  resting shadows or icon cards (apps = a list in large type), headings in one ink, body text in the full ink, mockups marked `data-ui`,
  `[data-hero]` / `[data-reveal]` rise-in motion in globals.css (reduced-motion safe); the dashboard has flat cards (`--d-shadow-card` 1px),
  no icons in tinted squares on KPIs / status tabs, a darker accent (#047857), amber (#b45309), rose (#b93a2f) and muted (#556274) for 4.5:1
  contrast, and `text-xs` = 13px. New UI keeps to these rules; `.taste-skill/` (its screenshots) is git-ignored.
- Homepage redesign (owner, Nov 2026: "modern, colourful, illustrations", replacing the Taste restyle; done with the frontend-design
  skill): idea = orders arriving from the 69 wilayas. `marketing/Home.tsx` hero = `HeroArt` (the real map from `marketing/map-lite.ts`, a
  light copy of `lib/algeria-map.ts` — credit line `landing.mapCredit` in the footer — lit wilayas, dashed routes `.sc-route` and pulses
  `.sc-pulse` in globals.css, order cards and a phone store), the dashboard screen on a violet stage, `Journey` (landing.journey, numbered:
  a real sequence), colourful bento, apps as white cards on a sky field, pricing on lilac (recommended = violet with a crown tag), violet
  CTA with parcels, plum footer. Palette: violet #5B3FF0, plum ink #1B1446 (never black), mint #12C59A, apricot #FFB23E, coral #FF6F61,
  sky #4CB3FF, lilac mist #F5F2FF; headings in Readex Pro (`--font-readex`). The Taste skill's no-colour/no-gradient rules do NOT
  apply to the homepage (owner's choice); its contrast and dashboard rules still do.
  Round 2 (owner: "the cards look old, no site screenshots"): after the hero there is NO product screenshot and no hand-drawn UI
  mock; every card carries a 3D illustration (`Art` → `public/home/*.webp`, 3dicons CC0, docs/third-party.md): `Journey` (6 numbered
  white cards), `Bento` = `FeatureCard`s (violet/indigo/apricot/sky/lilac/mint/coral fields, wide store + guard), `Apps` (white cards,
  icon tiles), `DeliveryArt` (pin + parcels + courier names), `TeamCards`, CTA rocket. Pricing keeps Zimam's/ayor's plan card texts
  (tag on top, name, "compare plans" link, price, note, button, tagline) — only colours change. The deploy folder must include
  `public/` (CI's "Assemble deploy folder" copies it).
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
- Wilayas: 69 (Law 26-06, `lib/wilayas.ts`; 59–69 carry `parent`). Couriers still get the 58 older codes (`carrierWilaya`, in
  `delivery/parcel.ts`); a new wilaya without its own delivery price takes its parent's (`delivery/settings.ts withNewWilayas`).
- Next 16 + Cache Components: pages under `[lang]` and `store` set `instant = false` in their root layout;
  call `connection()` before using `new Date()`/random values in server components outside a session read.
- Root layouts are `src/app/[lang]/layout.tsx` and (when the storefront is rebuilt) `src/app/store/layout.tsx`.
- No duplicated logic: reuse `src/ui`, `safeAction`, `permissions.ts`. Build a section completely, with its e2e
  test passing, before starting the next one.

## Roadmap (from the owner's feature list)
v2 rebuild order (sidebar): Phase 0 done (foundation, dark shell, auth, roles, profile), Phase 1 done (Products), Phase 2 done (Orders + storefront checkout, fake-order protection, abandoned carts), Phase 3 done (Delivery), Phase 4 done (Store Design), Phase 5 done (Theme Store), Phase 6 done (Call Centers), Phase 7 done (Landing Pages + AI + embeddable form), Phase 8 done (Analytics), Phase 9 done (Pixels: Meta, TikTok, GA4, GTM + server events), Phase 10 done (Apps: Google Sheets/Ecomanager, webhook, Shopify/YouCan import), Phase 11 done (Plans), Phase 12 done (Settings: details, SEO, policies, custom domain), Phase 13 done (platform admin), Phase 14 done (AI product descriptions), Phase 15 done (AI landing pages: reworked photos, extra photos, new sections, uncropped mobile-first layout).
Missing features seen in competitors (fraud score, coupons, multi-store, WhatsApp self-confirmation…) are listed
in `docs/next-round.md`: the homepage only claims what exists. Plans (modelled on ayor's, a little cheaper; seeded by
`scripts/migrate-lib.mjs`, missing codes added on start, older codes hidden once): starter (free) / orbit = pay as you go
(`plans.order_pack` = 100 orders for 1,800 DA, no expiry; `shops.order_credits` balance: `orderRule` in limits.ts, `takeOrderSlot`
uses one per order or locks it, top-ups via plan requests where `months` = packs, `releaseLockedOrders` spends the balance) /
rocket 3,500 / galaxy 6,900 a month / "Universe" custom (contact, a contract set by the admin). Labels: `features/plans/labels.ts`.
The homepage (`features/marketing/Home.tsx`, phase20.mjs) highlights `rocket`.
Next: the owner tests image landing pages with a real OpenAI key (image quality / Arabic text); real-account checks of the integrations with the owner's accounts (carriers, pixels, Sheets, OpenAI images) — code reviewed
against public docs/clients; ZR Express new platform added.
The v1 code (main branch) has working versions of most features to consult while rebuilding.
