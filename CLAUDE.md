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
- `src/later/` — v1 helpers kept for upcoming sections (safe-fetch, product-import, storage, tracking). Any server-side
  fetch of a user URL must go through `safe-fetch.ts`.
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
v2 rebuild order (sidebar): Phase 0 done (foundation, dark shell, auth, roles, profile). Next: Products, Orders +
storefront checkout (fake-order protection, abandoned carts), Delivery (wilaya rates, Yalidine/ZR Express/Noest),
Store Design, Theme Store, Call Centers, Landing Pages, Analytics, Pixels, Apps (Google Sheets, Ecomanager,
YouCan/Shopify import), Plans (limits/contracts/thresholds), Settings (custom domain), platform admin, AI last.
The v1 code (main branch) has working versions of most features to consult while rebuilding.
