# Scaleitto — Design System (MASTER)

Source of truth for every screen (dashboard, auth, admin, marketing). Storefront themes keep their own `s-*` tokens
(src/features/themes/themes.ts) but follow the same rules for touch targets, contrast and forms.
Generated with UI/UX Pro Max (`"ecommerce saas merchant dashboard" --design-system`, density 7, variance 5, motion 3),
then adjusted to the owner's brief: white + green, Arabic RTL first, sidebar menu names unchanged.

## Direction
Product: an operations tool for cash-on-delivery merchants and their call-center agents (long sessions, many forms
and tables, mostly on laptops, sometimes on phones). Style: clean "Sales Intelligence" dashboard on white surfaces,
one signature element — the deep-green sidebar — and green used only where it means something (primary action,
active place, success). Everything else is quiet and legible.

Adjustments to the tool's proposal (and why):
- Primary #059669 + white text is 3.8:1 → buttons use **#047857** (5.5:1); #10B981 only for graphics/indicators.
- Rubik / Nunito Sans have no Arabic → **IBM Plex Sans Arabic** for the whole interface (Arabic + Latin, 400–700).
- Orange #EA580C kept only as the "attention" color (new orders, warnings), never as decoration.
- Mint page background (#ECFDF5) read as tinted cards → neutral green-grey canvas #F3F6F4 so white cards stand out.

## Color tokens (src/app/globals.css)
| Token | Hex | Use |
|---|---|---|
| bg | #F3F6F4 | page canvas |
| panel | #FFFFFF | cards, header, inputs on focus |
| panel-2 | #F6F8F7 | table heads, quiet blocks, hover |
| field / field-line | #F7FAF8 / #B9C6BF | form fields (fill + edge) |
| line | #D5DED9 | card borders, dividers |
| fg | #0F2A20 | text |
| muted | #556860 | secondary text (≥ 5:1 on white) |
| accent | #047857 | primary buttons, links, active (white text 5.5:1) |
| accent-bright | #10B981 | indicators, charts, sidebar active icon |
| attention | #C2410C | warnings / new / waiting (text on white 5.2:1) |
| danger | #DC2626 | destructive |
| info | #0369A1 | information |
| sidebar | #0B2A1F → #082018 | navigation surface |

## Type
IBM Plex Sans Arabic (variable via next/font, preloaded only in the dashboard layout). Scale: 12 (meta) / 14 (UI, tables)
/ 16 (body, inputs on mobile) / 18 (card titles) / 24–28 (page titles, 700). Line-height 1.6 body, 1.25 titles.
No all-caps labels, no letter-spaced eyebrows.

## Shape, space, depth
Radius: 10px controls, 14px cards, 999px pills. Spacing 4/8/12/16/24/32. Cards: 1px line border + soft shadow
`0 1px 2px rgba(16,24,40,.05), 0 8px 24px -12px rgba(16,24,40,.12)`. Touch targets ≥ 40px (44px on phones).

## Components
- Button: primary (accent, white), secondary (white, line border), ghost, danger; h-10, focus ring 3px accent/25.
- Fields: visible label above, hint below, error under the field in danger; select with its own chevron.
- Card: title 16–18px bold; optional description; content padding 20px.
- Badge: tinted pill with a status dot (status never by color alone: always a word).
- Table: panel-2 head, 14px rows, row hover, numbers tabular.
- Alert: icon + text, tinted by kind.
- Page header: title + description + actions on one line (wraps on phones).

## Motion
150–200ms color/shadow transitions only; no entrance animations in the dashboard; respect prefers-reduced-motion.

## Pre-delivery checklist
Contrast ≥ 4.5:1 for text · visible focus · no emoji icons (Lucide) · no horizontal scroll at 375px ·
labels on every field · loading feedback on every action · RTL and LTR both checked.
