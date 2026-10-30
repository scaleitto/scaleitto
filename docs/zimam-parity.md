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
3. **Products** — editor tabs (details, description, variants & stock, checkout & delivery, offers), physical/digital,
   collections, live phone preview, sticky footer actions; products list columns.
4. **Delivery** — general settings (delivery options and prices), delivery companies (catalog, auto-send on confirm),
   handover manifest template (fields, branding, paper, language, preview, draft/publish).
5. **Connected platforms, call center, team** — channel cards (Google Sheets, Shopify, WooCommerce, YouCan…), agents,
   team invitations.
6. **Landing pages** — stats cards, list/grid, filters; builder with components, settings panel, suggestions, history.
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
