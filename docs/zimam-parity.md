# Zimam parity — the plan

The owner asked to rebuild the platform's structure, design and features after Zimam (app.getzimam.com), keeping our own
name, logo and wording (no copied texts, images, theme names or code). Each phase is built, tested and pushed on its own.

## Phases
1. **Shell** — done: sidebar groups (sell / grow / storefront / account), store card, user menu, support; top bar with
   quick search (⌘K), usage pill, language, visit store, notifications, dark mode; slate + emerald tokens.
2. **Overview, orders, scan** — done (phase26.mjs): status tabs with counts (pending, confirmed, call back, in transit, delivered, returned,
   abandoned, cancelled, flagged), toolbar (filter dialog, export, refresh, search, scan, new order), inline-editable table
   (amount, status, delivery type, agent, delivery company, note), order edit dialog (products, quantity, price, agent,
   note, IP + block, tracking link, delivery info, fee waived, status), parcel scanner (dispatch / recuperate).
   Our additions kept on the order page under the form: courier sending, customer messages, call guide, risk check,
   history. The round 8/9 models (five status sections, call counts, returns sub-page, leads table) were dropped; the
   migration 0027 maps the old statuses and turns saved carts into "abandoned" orders.
3. **Products** — done (phase27.mjs): editor tabs (details, description, variants & stock, checkout & delivery, offers), physical/digital,
   collections, live phone preview, sticky footer actions; products list columns. Built: tabs, phone preview, clear /
   create & add another / create, short description (7 words), description images, alert threshold, show when sold
   out, the product's delivery company (copied to its orders), similar products (auto or chosen), list columns with
   units sold. Waiting for their phase: collections (apps), digital products and online-payment-only (online payments),
   the delivery option (delivery settings).
4. **Delivery** — done (phase28.mjs): general settings (delivery options and prices), delivery companies (catalog, auto-send on confirm),
   handover manifest template (fields, branding, paper, language, preview, draft/publish). Built: three sub-pages
   (companies / manifest / settings), delivery on-off, one option per type (home / desk) priced by the wilaya table, a
   fixed price or free, auto-send of confirmed orders that have a company, manifest template + printing the selected
   parcels from the orders page (Confirmed / In transit). The product's "delivery option" picker is still to do.
5. **Connected platforms, call center, team** — done (phase29.mjs): channel cards (Google Sheets, Shopify, WooCommerce, YouCan…), agents,
   team invitations. Built: Connected platforms page (Google Sheets moved from Apps; Shopify and WooCommerce receive
   their orders through a signed address; YouCan, LightFunnels, Orderdz, Storeep shown as coming until their formats are
   verified), Team page (invite by email with a role, counter against the staff limit, pending invitations, acceptance
   page). The call center keeps its agents, schedules and distribution.
6. **Landing pages** — done (phase30.mjs): stats cards, list/grid, filters; builder with components, settings panel, suggestions, history.
   Built: list (total / live / draft / views, status + product filters, sort, list or grid remembered, create window:
   design manually = blank page with the form, or the AI builder), builder (components palette, page order, suggestions
   — real reviews, a countdown only for a real deadline, trust badges, FAQ —, click-to-select preview, settings panel,
   save state, history of the last 20 saves with restore, discard, publish), new components announcement bar and
   spacer. Not built: A/B versions (dropped earlier by the owner), thank-you popup.
7. **Analytics** — tabs (orders, products, impressions, call center), comparisons, status distribution, funnel, insights,
   wilayas.
8. **Pixels and apps** — pixel cards (GTM, GA, Facebook, Snapchat, TikTok); app store with on/off apps (WhatsApp
   confirmation, cart, abandoned orders, fake-order guard, agent and delivery auto-assign rules, blacklist, trust badges,
   quick contact buttons, thank you, QR codes, order tracking page, promotions, product import, custom fields,
   collections, parcel scanner, online payments, wholesale).
9. **Storefront** — page builder (header, announcement bar, navigation, sections, footer, custom pages, draft / publish /
   history), theme store, store settings tabs (general, domain, language, checkout fields, product page).
10. **Account** — plans (PAYG with credits + monthly plans, prepaid terms with discounts, card / local payment), balance
    (credits wallet, packs, transactions), profile.
