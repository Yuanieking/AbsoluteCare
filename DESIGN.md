# AbsoluteCare Design Direction

> Reading this as: a clinic scheduling portal plus a public clinic page, for patients in pain,
> parents of children in therapy, and clinic staff in Malaybalay City — in a warm editorial
> clinical language, with dial **ENERGY 2 / RHYTHM 2 / MOTION 1**.
>
> Revised 2026-10-30. This revision supersedes the earlier split between a landing palette and a
> portal palette, the uppercase eyebrow labels, the dot-grid canvas, and the lime active-nav
> indicator. Those were removed in code; this file now describes what ships.

## One system, two registers

The landing page and the signed-in portal share one palette, one type pairing, and one motion
budget. They differ in density, not in identity: the public pages breathe and stay editorial, the
portal is a workstation. Two palettes was the earlier mistake — it let the same brand read as two
products and forced every component to be restyled twice.

**Dials.** ENERGY 2 because the audience is often anxious; nothing raises its voice. RHYTHM 2
because composition should vary with content, not with a template. MOTION 1 because this is a
scheduling tool opened many times a day: press feedback, hover, loading and progress only. No
scroll reveals, no parallax, no entrance choreography, no staggered grids.

## Palette — "paper & pine"

Warm paper neutrals, one deep pine primary, one ochre attention signal, one clay destructive. The
accent is a colour with a job, not a mood.

| Token                                | Value                               | Job                                        | Why                                                                                                                             |
| ------------------------------------ | ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `--ac-canvas`                        | `#f2f0e8` public / `#eae8df` portal | Ground behind the working plane            | Warm paper so long appointment lists do not glare; the portal canvas drops a shade so the panel reads as a sheet laid on a desk |
| `--ac-panel`                         | `#fffefb`                           | The plane content sits on                  | Slightly warm white; pure white is kept for cards so the two layers stay distinguishable                                        |
| `--ac-card`                          | `#ffffff`                           | Flat content on the plane                  | One step brighter than the panel, so a card edge is visible without a heavy border                                              |
| `--ac-sunk`                          | `#e7e4da`                           | Wells: tab tracks, rails, skeletons        | Recessed, not elevated — wells must never look clickable                                                                        |
| `--ac-ink`                           | `#17211d`                           | Primary text and the scrim                 | Green-black sits inside the palette; pure black reads cold against paper                                                        |
| `--ac-ink-soft`                      | `#54615b`                           | Secondary text                             | 4.6:1+ on panel; body copy is never lighter than this                                                                           |
| `--ac-ink-faint`                     | `#6e7a74`                           | Labels, meta, icons                        | Darkened from the earlier `#778b8a`, which failed for small text                                                                |
| `--ac-hairline` / `--ac-hairline-in` | `#d9d5c9` / `#ece8de`               | Structure / structure inside a card        | Hairlines do the dividing so shadows do not have to                                                                             |
| `--ac-primary`                       | `#14453b`                           | The one action colour                      | Deep pine reads as clinical trust rather than tech blue                                                                         |
| `--ac-primary-strong`                | `#0c2f28`                           | Pressed and hover on primary               | Darkens instead of lightening; darker always reads as pressed                                                                   |
| `--ac-primary-soft`                  | `#dde8e1`                           | Selected rows, focus support, avatar wells | The pine tint, not a second hue                                                                                                 |
| `--ac-eyebrow`                       | `#4e6428`                           | Annotation and headline emphasis           | Moss, legible on paper, clearly not an action                                                                                   |
| `--ac-signal` / `-soft`              | `#8a5a12` / `#f7efdd`               | Waiting on a human, unpaid                 | Attention, not error — keeps amber away from destructive red                                                                    |
| `--ac-destructive` / `-soft`         | `#8f3b2f` / `#f7e7e2`               | Failure, deletion                          | Clay, not fire-engine red                                                                                                       |
| `--ac-lime`                          | `#d8e37c`                           | Brand marks and landing headline emphasis  | The one saturated note; never body text on light, never a UI state                                                              |
| `--ac-ring`                          | `#2f6b58`                           | Focus outline                              | Pine-derived, so focus belongs to the palette                                                                                   |

**Status pairs** (tint + text): pending `#f7efdd`/`#8a5a12`, confirmed `#e4eff2`/`#1d5a70`,
completed `#e3efe4`/`#2a6b45`, cancelled `#f7e7e2`/`#8f3b2f`, no-show `#eceeea`/`#4a5450`. Each
pair is ≥4.5:1 for the label, and the chip also carries a dot and a word, so state is never
colour-only.

**Charts.** `#2c6e57` pine, `#3f6f8a` slate blue, `#a8781f` ochre, `#a4553f` clay, `#5f7440` moss,
`#8a8577` stone. Six distinguishable hues from the same earthy family. None of them carry small
text on their own; the legend does that work.

**Rules.** Two cores plus one signal is the ceiling. A new colour needs a named job before it
enters the file. No blue-purple gradients, no glow, no neon, no purple-on-black, no blurred radial
orbs. Nothing in the palette is decorative.

## Type

- **Display: Bricolage Grotesque** — headings, page titles, stat values, dates. Chosen because its
  slightly squared terminals give the clinic a specific editorial voice; Inter/Geist/Space
  Grotesk would have been the default, not a decision.
- **UI: the platform system stack** (`system-ui`, `-apple-system`, `Segoe UI`, Roboto). It already
  ships optical sizing, tracking tables and legibility tuning, and the portal is dense — a bespoke
  UI face would cost legibility for personality we already get from the display face.
- **Sizes.** Body 14px; UI copy 12.5–13px; labels and meta 11.5px floor; page titles 28–30px;
  display numbers 27–40px; landing headlines `clamp()` up to 64px. Nothing renders below 10.5px,
  and that only for keyboard hints.
- **Tracking.** Negative above 20px (`-0.02em` to `-0.045em`), body at 0, small labels at 0.
  A single fixed tracking value is wrong at one end or the other.
- **No uppercase micro-labels.** Earlier labels used `uppercase` with `0.04–0.08em` tracking.
  They read as template chrome and slowed scanning of the very labels people skim. Labels are now
  sentence case, 11.5px, medium weight, `--ac-ink-faint`.
- **Numbers compare, so they are tabular.** `tabular-nums` on money, counts, times and stat values;
  `text-wrap: balance` on headings, `pretty` on paragraphs.

## Shape and depth

- **Radii:** `3 / 4 / 6 / 9 / 13 / 18px`. Controls are 6px, cards and panels 9px, overlays and the
  app plane 13px, the phone sheet 18px. Not every element is a pill: the radius tells you what kind
  of object you are looking at. Status chips use 4px, avatars stay circular.
- **Depth:** structure is a hairline first. There are exactly three shadows —
  `--shadow-card` (1px, the only one under flat content), `--shadow-pop` (menus, popovers),
  `--shadow-modal` (dialogs, drawers). Nothing else floats.
- **No glass.** Zero `backdrop-filter` in the product. The earlier dot-grid canvas and translucent
  chrome made every surface sit in the same frosted layer; hierarchy collapsed. Scrims are solid
  `ink/40`.
- **Dividers, not boxes.** Sibling rows inside a card share a `hairline-in`; the card itself keeps
  one `hairline`. Two nested borders around one idea is a hierarchy smell.

## Motion

| Token           | Value                             | Use                            |
| --------------- | --------------------------------- | ------------------------------ |
| `--ease-snap`   | `cubic-bezier(0.23, 1, 0.32, 1)`  | Entrances, press, hover, menus |
| `--ease-glide`  | `cubic-bezier(0.77, 0, 0.175, 1)` | Movement across the screen     |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)`  | Sheets and drawers             |

- 100–150ms for press and hover; 150–200ms for menus and dialogs; 300ms maximum for a drawer,
  with exits ~50ms faster than entrances. UI animation never exceeds 300ms.
- **Press feedback everywhere:** `active:scale-[0.985]` at 150ms, disabled under
  `prefers-reduced-motion`. The interface should acknowledge the press before the network does.
- **Exact properties only.** `transition-all` is banned; transitions name colour, transform,
  border or box-shadow.
- **No loops.** The only repeating motion is indeterminate progress (loader bar, route bar,
  skeleton sheen). Decorative pulses, floating cards and glowing dots are removed.
- **Interruptible surfaces.** Menus and popovers animate from their trigger
  (`transform-origin: var(--radix-*-transform-origin)`) at 150ms; dialogs stay centred.
- `prefers-reduced-motion` collapses travel and keeps opacity/colour; `prefers-reduced-transparency`
  makes materials solid; `prefers-contrast: more` thickens hairlines and darkens faint ink.

## Layout — the shell

- **Three layers.** Canvas, rail, panel. The rail and header belong to the canvas; all work sits on
  one paper plane, 13px radius, one hairline, one 1px shadow.
- **One scroll.** On desktop the panel is the only scrolling element. The phone is one continuous
  sheet with no inner scroll.
- **Navigation is grouped by job.** Admin: Care / People / Business / System. Therapist: Today /
  Records. Secretary: Front desk / Account. Patient: Your care / Family. Section labels are named
  for their contents ("Clinic overview", "My day") rather than "Dashboard" everywhere.
- **The active nav item is a paper chip** with a hairline ring and a pine icon. The old lime
  left-stripe said "selected" but read as decoration and competed with the content; a filled chip
  is the familiar selected-object pattern.
- **Tabs are an underline row**, not pills. Pills competed with primary buttons for the same visual
  weight; an underline says "same level, different view".
- **Header** is 56px: section / tab / context, then search, then account. It never contains
  actions that also live in the page header.
- **Page frame:** 1200px maximum, 20/32px gutters, hairline under the page header. One column
  unless the content asks for two.
- **Touch and keyboard:** interactive rows are reachable and 40px+; the skip link is first in the
  DOM; the mobile drawer traps focus and returns it.

## Components

- **Signature objects, one per register.** The landing hero is a CSS-drawn therapy room (sun, chair,
  plant, room lines). The portal's is the appointment docket — next visit set like the slip taped to
  a treatment-room door, with a perforated tear and punched notches. They are the only decorated
  objects; everything else is a hairline on paper.
- **Status:** tinted chip, 4px radius, dot, word. Never colour alone.
- **Stat tiles:** sentence-case label, 27px display number, caption that names the comparison, an
  optional sparkline, and a border change on hover when the tile links somewhere.
- **Empty states** name the cause and the next action ("No jobs yet. Run a sync…"), not "No data".
  Loading says what is loading. Errors say what failed and what to do.
- **Tables:** sentence-case headers at 11.5px/600, 40px rows, sibling hairlines, hover tint. The
  deciding column sits early — columns come from the decision, not from the model.
- **Fields** share one base: 36px height, 6px radius, hairline, inset 1px shadow, pine focus border
  plus a 3px 15% ring. Labels sit above the field at 12.5px; hints are 11.5px.
- **Focus** is always visible: 2px `--ac-ring` outline at 2px offset, or the field ring above.
  It is never removed in favour of `:hover`.

## What we deliberately do not do

- **Dot-grid canvases, blueprint lines, graph paper.** Removed: stock "technical" texture that
  competed with the content and made the plane harder to read.
- **Uppercase, wide-tracked eyebrow labels.** Replaced with sentence-case labels.
- **Coloured left stripes** that only decorate. A stripe is allowed only when it carries state,
  and we currently have no such case.
- **Decorative arrows and status dots.** An arrow must point at a real destination; a dot must mark
  a real state, and it does not pulse.
- **Pill-shaped everything, oversized radii, shadows on every card, glow, glass.**
- **A dark theme.** This is a daylight, paper-based clinical product, so dark would be a trend, not
  a decision. If a real requirement appears, add a working toggle rather than a dark default.
- **Invented numbers, deltas and activity feeds.** A metric appears only when it is wired to data,
  with the comparison period named.

## Access and verification floor

- AA contrast for text, 3:1 for non-text and focus, verified at token level.
- Keyboard-only pass on every screen; visible focus; labelled controls; skip link.
- `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more` honoured.
- Before shipping a UI change: `npm run typecheck`, `npm run lint`, `npm run build`, and the
  project's own suite (`npx vitest run src`). A clean build is not a visual check — screens that
  changed layout need eyes on them.
