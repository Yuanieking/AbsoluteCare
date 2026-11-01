# AbsoluteCare Agent Guide

## Repository Layout

- `backend/` contains the TypeScript/Express API (`tsc` compiles to `dist/`), with configuration under `src/config` (`src/config/paths.ts` is the only place that resolves package paths), controllers under `src/controllers`, routes under `src/routes`, Zod schemas under `src/schemas`, services under `src/services`, and Mongoose models under `src/models`. Seed and utility scripts live in `scripts/` and run through `tsx`.
- `frontend/` contains the React 19/Vite client. The current UI entry points are `src/main.jsx` and `src/App.jsx`; shared styles are in `src/index.css` and `src/App.css`.
- Keep frontend and backend changes in their respective package directories unless a cross-boundary contract requires both sides to change.

## Commands

Run commands from the package directory that owns them:

- Backend development: `cd backend && npm run dev` (`tsx watch src/app.ts`)
- Backend validation: `cd backend && npm run typecheck` and `cd backend && npm run build`
- Backend production: `cd backend && npm start` (runs the compiled `dist/src/app.js`)
- Backend seed: `cd backend && npm run seed` (`npm run seed:reset -- --yes` to wipe seeded data)
- Frontend development: `cd frontend && npm run dev`
- Frontend validation: `cd frontend && npm run lint` and `cd frontend && npm run build`
- Backend tests are not configured yet; `backend/npm test` is the placeholder script and is expected to fail.

## Conventions

- Backend uses native ESM, TypeScript under the strict flag set in `backend/tsconfig.json`, double quotes, and semicolons. Include `.js` extensions in local imports, even from `.ts` files (NodeNext resolution), and use `import type` for type-only imports.
- Backend layering: routes wire middleware and controllers; controllers may import schemas, services, `errors/` and `types/` but not `models/` or Mongoose; services own persistence and must not touch Express request/response objects.
- Zod schemas are the source of truth for request shapes; derive types with `z.infer` instead of hand-writing duplicates.
- Frontend uses ESM, single quotes, and no semicolons. Follow the existing ESLint configuration and React Hooks/Refresh rules.
- Prefer the existing Express, Mongoose, and Zod structure over introducing new layers. Keep route wiring, request handling, validation, and persistence responsibilities separate.
- Never commit secrets from `backend/.env`; verify ignore rules before adding environment-related files.

## Backend Change Checks

- Load environment variables before reading configuration values, and verify the server can start under Node's native ESM resolution.
- Ensure Express JSON parsing is enabled before handlers read `req.body`.
- When changing authentication, keep the Zod schema, controller input handling, and Mongoose user model in agreement, including confirmation fields and required profile data.
- Confirm new users are actually persisted and that password omission/sanitization does not mutate or expose credentials.
- Run `npm run typecheck` and `npm run build` after backend edits, then boot the affected startup path (`npm run dev` or `npm start`) because the package has no automated test suite.
- Exercise the affected endpoint after backend edits; keep responses byte-identical, since the frontend consumes the whole API.

## Documentation

- The only current project documentation is the Vite starter README at [frontend/README.md](frontend/README.md). Update or replace it when adding real frontend setup or usage instructions rather than duplicating those details here.
