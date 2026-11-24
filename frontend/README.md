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

## Integration defaults

Settings → Integrations → **Reset to Default** resets all managed credentials together.
Original backend `.env` variables remain defaults. Admin edits are encrypted in the
database and mirrored as `CUSTOM_<VARIABLE_NAME>` when `.env` writing is enabled.
For example, `CUSTOM_BREVO_API_KEY` overrides the original `BREVO_API_KEY`.

Reset requires the superuser password, an emailed code, and confirmation. It removes
custom overrides, leaves integration switches unchanged, and requires a server restart.
Missing defaults leave an integration unconfigured. Calendar accounts may need to reconnect.
On read-only servers, database reset markers suppress remaining `CUSTOM_` values.
Original keys overwritten by older versions are not recoverable automatically; restore
trusted original values manually before relying on reset.

## Permissions and backup recovery

Admin → Permissions controls staff CRUD access. Read-only does not permit mutations;
unchecked or unknown permissions deny access. Admin access remains always enabled.
Own-account profile/availability edits remain outside clinic-area permissions.

Admin → Settings → Backup exports all database collections, including password hashes
and stored secret ciphertext. Both export and restore require the superuser password
and emailed verification code (`SU_PASS`, `SU_EMAIL`, and configured mail delivery).
Treat the downloaded file as sensitive; transport HTTPS and protect it at rest.

Backups use canonical MongoDB Extended JSON to preserve IDs, dates and BSON values.
The browser feature is capped at 32 MiB and requires a MongoDB replica set or sharded
cluster for snapshot/transaction support. Standalone databases are refused without
changing data; use `mongodump` / `mongorestore` for larger or standalone databases.

For recovery: initialize the target collections/indexes, enable Maintenance, choose
the JSON file, type RESTORE, then complete verification. Replacement commits atomically
or rolls back; indexes remain intact. Maintenance stays enabled afterward. Sign in
with a restored admin account, verify clinic data and integrations, then disable
Maintenance. Pending verification codes are deliberately not reactivated on restore.

This is a **database backup**, not a server/filesystem backup. Preserve the original
server `.env` separately and securely, including `CREDENTIAL_ENCRYPTION_KEY`,
`GOOGLE_CALENDAR_ENCRYPTION_KEY`, and `JWT_SECRET` as configured. A different encryption
key cannot decrypt restored integration ciphertext. External Google Drive files and
server assets must be backed up separately; no secret is redacted from database data.

Automated checks use persistence fakes; conduct a recovery drill on a disposable replica
set before relying on this feature. Never perform that drill against clinic production.

## Audit logs and clinic timestamps

Admin → Audit log (`/staff/admin/audit`) shows persistent application changes with
search, actor/role/category/result filters, inclusive Manila date filters, server-side
pagination, entry details, and streamed filtered CSV export. Therapists and patients
see only their own activity in Profile. The server applies ownership to list/detail
queries; private views expose metadata only, never staff notes or field values.

The application captures model creates, edits and deletes, including background jobs,
settings/integration changes and backup operations. Passwords, tokens, API-key values,
clinical notes and contact details are redacted; safe status/schedule/payment/permission
field changes remain visible to Admin. Failures at the persistence boundary are marked
as failed, without recording error payloads. Sign-in attempts, denied-access events and
record views/download tracking were not enabled for this scope.

On first database startup, an idempotent import copies previously stored account,
appointment/payment, session-edit, service and settings audit histories into the unified
trail. Legacy rows are labelled; missing historical values/actors are not invented.
No TTL or edit/delete API exists. Database administrators can still alter database data;
this is not cryptographic tamper-proof storage or a MongoDB change-stream recorder.
Direct database writes outside the application are not captured. Audit appends share
an existing transaction where supplied; ordinary nontransactional writes and their
audit append are separate operations, so audit persistence errors must be monitored.
Audit history is retained/merged rather than erased by database restore.

UTC instants stay UTC in storage and API responses. Clinic date-only/offset-less inputs
are interpreted as Asia/Manila; date ranges and charts use Manila day/month boundaries.
Display and CSV labels explicitly use Manila (UTC+08). Existing stored timestamps are
not rewritten. Timestamp regressions run under UTC and America/New_York host zones.

## Tests

Logic is covered with Vitest; UI is verified manually per role.

```bash
npm test
```

Keep changes to formatters, validators, query keys or nav config covered by a
test next to the module (`*.test.ts`).
