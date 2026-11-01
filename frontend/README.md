# AbsoluteCare frontend

React 19 + TypeScript client for the AbsoluteCare physical therapy clinic. The
API contract is the `backend/` package; this app consumes it and does not
change it.

## Setup

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

`VITE_API_URL` sets the API origin and defaults to `http://localhost:8080`. The
backend must allow that origin with credentials. To point the app elsewhere,
create `.env.local` with:

```
VITE_API_URL=http://localhost:8080
```

## Scripts

| Command             | What it does                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`       | Vite dev server                                                              |
| `npm run typecheck` | `tsc --noEmit` over the app project (strict)                                 |
| `npm run lint`      | ESLint (TypeScript + React Hooks + Refresh rules)                            |
| `npm test`          | Vitest — logic tests only (formatters, validators, query keys, route config) |
| `npm run build`     | Typecheck the project references, then produce `dist/`                       |
| `npm run gen:api`   | Regenerate `src/types/api.ts` from the backend sources                       |
| `npm run format`    | Prettier over the package                                                    |

## Structure

```
src/
├── app/            router, providers, nav config, route guards
├── components/     presentational building blocks
│   ├── ui/         shadcn primitives (Radix)
│   ├── charts/     bklit chart components (vendored, unmodified)
│   ├── layout/     AppShell, rail, tabs, page header, layouts
│   ├── data-table/ DataTable built on TanStack Table
│   ├── domain/     StatusBadge, StatTile, ChartCard, AppointmentDocket…
│   └── feedback/   loader, skeletons, empty states, progress bar
├── features/       one folder per role/domain (auth, landing, patient,
│                   therapist, secretary, admin, notifications, settings, dev)
├── hooks/          hooks shared by three or more features
├── lib/
│   ├── api/        axios client, typed endpoint modules, query keys, query client
│   ├── format/     date, currency, name and relative-time formatters
│   └── …           validation, toast, redirect helpers, `cn()`
├── styles/         `index.css` (Tailwind + base layer) and `tokens.css`
└── types/          generated API types plus shared domain types
```

Rules of thumb: feature code stays in its feature, pages compose `components/`
instead of styling raw HTML, and nothing outside `lib/api` calls axios.

## Styling

Tailwind v4 utilities over one CSS-variable theme.

- Every colour, radius, font and status value lives in `src/styles/tokens.css`.
  Components use the semantic utilities (`bg-panel`, `text-ink-soft`,
  `border-hairline`, `text-status-pending`, `bg-chart-2`); raw hex values and
  arbitrary colour classes are not used.
- Two scopes map the same names to different palettes: the public pages use the
  `:root` defaults, and `AppShell` tags the signed-in shell with
  `data-surface="portal"`.
- Add a token to `tokens.css` and map it in `@theme inline` before reaching for
  an arbitrary value.
- Light theme only. Focus rings use `--ring`; motion is limited to springs,
  layout transitions and the route fade, all disabled under
  `prefers-reduced-motion`.

## UI primitives

shadcn components are vendored into `src/components/ui/` (new-york style,
`components.json`). Add more with the CLI rather than hand-writing one:

```bash
npx shadcn@latest add sheet
```

Domain components in `src/components/domain/` are the only way pages render a
status badge, stat tile, money value, chart frame, filter bar or empty state —
no page-local reimplementation.

## Charts

bklit registry components live in `src/components/charts/` verbatim so future
`npx shadcn@latest add @bklit/pie-chart` calls keep working. Wrap charts in
`ChartCard` (`title`, `subtitle`, `actions`, `state`) and keep API-to-chart data
adapters next to the page, not inside the chart components. Chart colours come
from the `--chart-*` tokens.

## Dev gallery

`/dev/components` is a development-only route (tree-shaken out of production
builds) showing tokens, every primitive and domain component, each chart in
loading/empty states, page patterns and the motion presets. Use it when adding
or changing a shared component.

## Tests

Logic is covered with Vitest; UI is verified manually per role.

```bash
npm test
```

Keep changes to formatters, validators, query keys or nav config covered by a
test next to the module (`*.test.ts`).
