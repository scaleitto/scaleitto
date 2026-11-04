# Public store API (Store settings → Domain → Allowed origins)

For a merchant who builds their own storefront on another website. Base URL: `<APP_URL>/api/storefront/v1/<store ID>`
(both shown on the Domain tab). Browsers may call it only from the store's **allowed origins** (`https://` + domain, up to
10); calls from a server (no `Origin` header) are accepted. Prices are integer DZD.

| Method | Path | Answer |
|---|---|---|
| GET | `/products` | `{ products: [{ id, slug, name, price, compareAtPrice, images, url }], currency }` |
| GET | `/products/<slug>` | `{ product: { id, slug, name, price, compareAtPrice, images, descriptionHtml, options, variants, offers, available } }` |
| GET | `/shipping` | `{ wilayas: [{ code, name: { ar, fr }, home, office }] }` — `null` = not delivered there |
| POST | `/orders` | JSON `{ productId, variantId?, quantity, name, phone, wilaya, commune, address?, deliveryType, note?, captcha?, userAgent? }` → `201 { order: { id, number } }` |

Errors: `404 store_not_found | product_not_found`, `403 origin_not_allowed`, `422 { error: "invalid_fields", fields }` (field →
reason) or `422 { error }` with the store form's reasons (`shipping`, `outOfStock`, `blocked`, `captcha`…). Orders go through the
same checks as the store's own form (checkout fields, fake-order protection, stock, plan quota) and appear in Orders with an
"API" line.
