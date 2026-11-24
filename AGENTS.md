# AbsoluteCare Agent Guide

## Repository Layout

- `backend/` contains the plain JavaScript Express 5 API (no build step; Node runs `src/` directly from `src/app.js`), with configuration under `src/config` (`src/config/paths.js` is the only place that resolves package paths, and `src/config/env.js` is the only place that reads `.env`), routes under `src/routes`, controllers under `src/controllers`, Zod schemas under `src/schemas`, services under `src/services`, Mongoose models under `src/models`, middleware under `src/middleware`, typed errors in `src/errors/AppError.js`, background jobs under `src/jobs`, helpers under `src/utils`, and email templates under `src/emails`. Tests live in `tests/*.test.mjs`. Seed and utility scripts live in `scripts/` and `seed.ts` and still run through `tsx`.
- `frontend/` contains the React 19 + TypeScript client built with Vite. The entry point is `src/main.tsx`, which renders `src/app/App.tsx` inside `AppProviders` (`src/app/providers.tsx`); routes are in `src/app/router.tsx`. Screens are organized by feature under `src/features/<area>/` (`api.ts`, `queries.ts`, `mutations.ts`, `schemas.ts`, `types.ts` beside the pages), shared UI is under `src/components/`, helpers and the Axios client are under `src/lib/` (`src/lib/api/client.ts`), and global styles are in `src/styles/index.css` and `src/styles/tokens.css`.
- The root `package.json` only runs both apps together (`npm run dev` from the repository root, via `concurrently`) and forwards `seed`/`seed:reset` to the backend.
- Keep frontend and backend changes in their respective package directories unless a cross-boundary contract requires both sides to change.

## Commands

Run commands from the package directory that owns them:

- Backend development: `cd backend && npm run dev` (`tsx watch src/app.js`; `node --watch` restarts spuriously on Windows)
- Backend validation: `cd backend && node --test "tests/*.test.mjs"` (13 test files on plain node, covering startup, auth, RBAC, record concurrency, documents, audit and backups; some tests connect to the MongoDB in `MONGO_URI`)
- Backend production: `cd backend && npm start` (`node src/app.js`)
- Backend seed: `cd backend && npm run seed` (`npm run seed:reset -- --yes` to wipe seeded data)
- Frontend development: `cd frontend && npm run dev`
- Frontend validation: `cd frontend && npm run lint`, `npm run typecheck`, `npm test` (Vitest) and `npm run build` (`tsc -b && vite build`)
- Frontend formatting: `cd frontend && npm run format` (Prettier)
- Both apps together: `npm run dev` from the repository root
- `npm test` in `backend/` is still the placeholder script and is expected to fail; use the `node --test` command above instead.

## Conventions

- Backend uses native ESM JavaScript with no type annotations or JSDoc types, Prettier defaults (double quotes, semicolons), and explicit `.js` extensions in local imports. No formatter or linter is installed in `backend/`, so match the surrounding style by hand.
- Backend layering: routes wire middleware and controllers; controllers may import schemas, services and `errors/` but not `models/` or Mongoose; services own persistence and must not touch Express request/response objects.
- Zod schemas are the source of truth for request shapes; validate with them instead of hand-writing checks.
- Frontend uses strict TypeScript (`tsconfig.app.json`), single quotes, no semicolons and a 100-character line width (`.prettierrc.json`). Import shared code through the `@/` alias and use `import type` for type-only imports. Follow the existing ESLint configuration (`eslint.config.js`) and React Hooks/Refresh rules.
- Frontend data access goes through the shared Axios client and TanStack Query hooks in each feature's `queries.ts`/`mutations.ts`, using the query keys in `src/lib/api/keys.ts`; forms validate with Zod schemas through React Hook Form.
- Prefer the existing Express, Mongoose, and Zod structure over introducing new layers. Keep route wiring, request handling, validation, and persistence responsibilities separate.
- Never commit secrets from `backend/.env`; verify ignore rules before adding environment-related files.

## Backend Change Checks

- Load environment variables before reading configuration values, and verify the server can start under Node's native ESM resolution.
- Ensure Express JSON parsing is enabled before handlers read `req.body`.
- When changing authentication, keep the Zod schema, controller input handling, and Mongoose user model in agreement, including confirmation fields and required profile data.
- Confirm new users are actually persisted and that password omission/sanitization does not mutate or expose credentials.
- Run `node --test "tests/*.test.mjs"` after backend edits, then boot the affected startup path (`npm run dev` or `npm start`).
- Exercise the affected endpoint after backend edits; keep responses byte-identical, since the frontend consumes the whole API.

## Documentation

- Frontend setup and usage (including `VITE_API_URL`) are in [frontend/README.md](frontend/README.md); seed usage is in [backend/scripts/README.md](backend/scripts/README.md). Update those files rather than duplicating their details here.
- [DESIGN.md](DESIGN.md) describes the UI design direction (palette, typography, motion) that the frontend follows.
- Project documentation lives in `docs/`, including [architectural-pattern.md](docs/architectural-pattern.md), [coding-standards.md](docs/coding-standards.md), the concurrency notes ([concurrency-control.md](docs/concurrency-control.md), [timestamp-concurrency-explained.md](docs/timestamp-concurrency-explained.md)), deployment and integration guides ([production-env-guide.md](docs/production-env-guide.md), [google-drive-setup.md](docs/google-drive-setup.md), [brevo-email-setup.md](docs/brevo-email-setup.md)), feature specs in `docs/spec/`, and the API reference in `docs/API_DOCUMENTATION_REVISED.docx`.
