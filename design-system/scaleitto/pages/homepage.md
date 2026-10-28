# Homepage (frontend-design pass) — overrides MASTER for the public homepage

Subject: an operations platform for cash-on-delivery sellers. Their world is orders, confirmation calls, parcels and
waybills (the printed delivery slip glued on every parcel). Audience: sellers deciding whether to open a store.
Primary job: understand in 5 seconds that the whole order journey lives here, then create a store.

## Weaknesses found (inspection, 1440 / 820 / 375 px)
- Feature pictures were grey bars and empty shapes (wireframes): the page looked unfinished.
- Hero phone hidden behind three notifications; the "10:08" box read as a placeholder.
- Journey = six identical cells in a grid; final CTA = dark card with a blurred glow (generic).
- No prices although the plans are real (database).

## Plan
Color: Ink #0B2A1F (sidebar), Canvas #F3F6F4, Paper #FFFFFF, Signal #10B981 (indicators), Accent #047857 (actions,
the stamp), Kraft #D8C3A0 (only the parcel behind the waybill).
Type: IBM Plex Sans Arabic only. Headline 700, tight leading; numbers tabular; no all-caps, no eyebrows.
Layout:
```
[header: brand | journey · features · pricing | language · login · create store]
[hero: headline + subtitle + 2 actions + facts | the waybill on a kraft parcel, stamped "confirmed"]
[journey: ink band, one horizontal rail with 6 nodes (vertical rail on phones) — a real sequence]
[features: 3 alternating rows with real mini screens: designed images with their text, the orders list with
 names/cities/amounts/statuses, delivery tracking with real carrier names]
[more: quiet two-column list]
[pricing: the active plans from the database, plain columns, prices and limits as stored]
[closing: ink band whose top edge is a waybill perforation, one action]
```
Principles: one bold object (the waybill and its stamp); everything else quiet. Real content everywhere, no grey bars.
One motion moment: on load the waybill settles and the stamp lands (skipped with reduced motion). Hover only where it
answers the pointer (buttons, plan columns). No new dependencies; no images to download (CSS + inline SVG).

## Review against generic defaults
- "Big headline + device mockup" is the common hero; replaced the phone by the waybill, specific to cash on delivery.
- Kraft could drift toward the warm-cream trait: limited to the small parcel, never a background.
- Orange stamp would read as the terracotta tell: the stamp is in the action green.
- Footer "© brand · rights" used a middle-dot meta string: replaced by two separate items.
