# Scaleitto — Design System (MASTER)

Source of truth for every screen (dashboard, auth, admin, marketing). Storefront themes keep their own `s-*` tokens
(src/features/themes/themes.ts) but follow the same rules for touch targets, contrast and forms.
Generated with UI/UX Pro Max (`"ecommerce saas merchant dashboard" --design-system`, density 7, variance 5, motion 3),
then adjusted to the owner's brief. Since the owner's ayor round, ayor.ai is the visual reference: white surfaces, deep
indigo ink and violet accents, IBM Plex Sans Arabic, Arabic RTL first, sidebar menu names unchanged.

## Direction
Product: an operations tool for cash-on-delivery merchants and their call-center agents (long sessions, many forms
and tables, mostly on laptops, sometimes on phones). Style: clean "Sales Intelligence" dashboard on white surfaces,
one signature element — the deep-indigo sidebar — and violet used only where it means something (primary action,
active place). Success stays green (#047857) in statuses. Everything else is quiet and legible.

Adjustments to the tool's proposal (and why):
- ayor's colors: violet **#4F3BD6** for primary buttons and links (white text 7.6:1), **#7C6CF2** only for indicators,
  ink **#080529** for the big marketing buttons and headings.
- Font = ayor's: **IBM Plex Sans Arabic** 400/500/600/700 (`src/app/ui-font.ts`, `--font-ui`, [lang] layout only; stores
  keep Cairo and their theme fonts).
- Orange #EA580C kept only as the "attention" color (new orders, warnings), never as decoration.
- Canvas #F6F6FB (a hint of lavender) so white cards stand out.

## Color tokens (src/app/globals.css)
| Token | Hex | Use |
|---|---|---|
| bg | #F6F6FB | page canvas |
| panel | #FFFFFF | cards, header, inputs on focus |
| panel-2 | #F7F6FD | table heads, quiet blocks, hover |
| field / field-line | #F8F7FD / #C7C3DD | form fields (fill + edge) |
| line | #E2E0EF | card borders, dividers |
| fg | #0B0820 | text |
| muted | #5F5B78 | secondary text (≥ 5:1 on white) |
| accent | #4F3BD6 | primary buttons, links, active (white text 7.6:1) |
| accent-bright | #7C6CF2 | indicators, charts, sidebar active icon |
| ink | #080529 | marketing buttons and headings (ayor's) |
| attention | #B53D0B | warnings / new / waiting (5.7:1 on white, ≥ 4.5 on its 10% tint) |
| danger | #DC2626 | destructive |
| info | #0369A1 | information |
| sidebar | #0D0A2B | navigation surface |

## Type
IBM Plex Sans Arabic 400/500/600/700 (next/font, [lang] layout only). Scale: 12 (meta) / 14 (UI, tables)
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
