# Security audit — November 2026

Method: Cloudflare's `security-audit` skill (`.claude/skills/security-audit/`, MIT), source-first. Every finding needs a
lower-trust actor, a crossed boundary and a concrete result. Checks ran only against the local test server with dummy stores.
Nothing deployed was probed.

**Coverage.** This was one focused pass by a single reviewer over the highest-risk boundaries listed below. It was not the
skill's full six-phase run with independent verifier agents, so it does not claim the rest of the code is clean. A later
full run should start from this file.

## Boundaries reviewed and holding

| Boundary | What was checked | Result |
|---|---|---|
| Store isolation (tenant) | Every `update`/`delete` by id in server actions and routes; order access through `visibleOrders` / `canTouchOrder`; export, label, latest-order routes | Scoped by `shop.id` (or loaded through a shop-scoped lookup first) |
| Payments and credits | `refreshPayment`, `refreshCreditPurchase`, `refreshPlanPayment`: owner scope, status asked from the gateway with the expected amount; approval run twice at once | Shop-scoped. `approveCreditPurchase` / `approvePlanRequest` lock the row (`FOR UPDATE` + `status = pending`), so credits or a plan are granted once |
| Platform admin | Every admin action and plan or credit decision | `requirePlatformAdmin` on each |
| Webhooks | WhatsApp (`X-Hub-Signature-256`, timing-safe), Shopify / WooCommerce channels (HMAC), cron key (timing-safe) | Signed or secret-keyed |
| Uploads | Type sniffed from bytes (no SVG), size limit, file names checked against a strict pattern when served, `nosniff` | No stored script, no path traversal |
| Stored XSS | Every `dangerouslySetInnerHTML`: product description through the `cleanRichText` allowlist (http/mailto/tel links only); theme script is a constant | No merchant- or buyer-controlled HTML |
| SSRF | Every server `fetch`: merchant URLs through `safe-fetch.ts`; Ecotrack base URL limited to `*.ecotrack.dz`; gateway and API hosts fixed | No arbitrary internal fetch |
| Sessions | Token hashed in the database, cookie `httpOnly` + `sameSite=lax` + `secure` in production; reset and invite tokens hashed and expiring | Holding |

## Confirmed and fixed

1. **Unlimited password guessing** (sign-in, call-center sign-in, the profile's current password). There was no limit on wrong
   passwords, so an unauthenticated attacker could guess an owner's password without ever being stopped. Fix:
   `src/server/rate-limit.ts`. Only failures are counted: 10 per account and 50 per IP within 15 minutes, then
   `tooManyAttempts`. Also limited: password-reset mails (3 per address, 10 per IP an hour) and sign-ups (20 per IP an hour).
   Regression test: `tests/e2e/phase0.mjs` "password guessing is stopped", plus unit tests in `tests/unit/security.test.ts`.
2. **Visitor IP read from a value the visitor writes.** Order limits, the IP blacklist, the risk score and the tracking-lookup
   limit took the *first* `X-Forwarded-For` entry. Any buyer could send a fake value there, so each order looked like it came
   from a new IP. Fix: one helper, `src/server/client-ip.ts`, which reads the last entry (the one the proxy wrote; adjustable
   with `TRUSTED_PROXY_HOPS`, or `CLIENT_IP_HEADER` behind Cloudflare). Unit tests in `tests/unit/security.test.ts`.
3. **A password change did not sign out other devices**, so a stolen session kept working. Fix: `endOtherSessions` after a
   change. The reset link already signed everyone out. The e2e test checks that only one session remains.
4. **Dashboard pages could be framed by another site** (clickjacking on actions like delete or bulk status changes). Fix:
   `X-Frame-Options: DENY` + `frame-ancestors 'none'` on `/ar|fr|en/…`, and `nosniff` + `Referrer-Policy` everywhere
   (`next.config.ts`). The storefront stays embeddable.

## Needs validation (facts outside the source)

- **How the host fills `X-Forwarded-For`.** The fix assumes one proxy that appends the address it saw (Apache / Passenger on
  cPanel). If the app is reached directly with no proxy in front, every per-IP rule still relies on a header the visitor
  controls. To check: on the server, log `X-Forwarded-For` for a request sent with a fake value and confirm the real
  address is the last entry.
- **Attempt limits live in memory.** With several app processes, each one keeps its own counter, so the effective limit is
  multiplied. A restart clears them. Move them to the database if the host runs several processes.
- **`PLATFORM_ADMIN_EMAIL`**: whoever registers this address first becomes platform admin. Safe once the owner's account
  exists. Do not set it to an address that has not registered yet on a public server.
