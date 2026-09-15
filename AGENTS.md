# AbsoluteCare Agent Guide

## Repository Layout

- `backend/` contains the Node.js/Express API, with configuration under `src/config`, HTTP handlers under `src/controller` and `src/router`, validation under `src/schema`, and persistence models under `src/models`.
- `frontend/` contains the React 19/Vite client. The current UI entry points are `src/main.jsx` and `src/App.jsx`; shared styles are in `src/index.css` and `src/App.css`.
- Keep frontend and backend changes in their respective package directories unless a cross-boundary contract requires both sides to change.

## Commands

Run commands from the package directory that owns them:

- Backend development: `cd backend && npm run dev`
- Frontend development: `cd frontend && npm run dev`
- Frontend validation: `cd frontend && npm run lint` and `cd frontend && npm run build`
- Backend tests are not configured yet; `backend/npm test` is the placeholder script and is expected to fail.

## Conventions

- Backend uses native ESM, double quotes, and semicolons. Include `.js` extensions in local imports.
- Frontend uses ESM, single quotes, and no semicolons. Follow the existing ESLint configuration and React Hooks/Refresh rules.
- Prefer the existing Express, Mongoose, and Zod structure over introducing new layers. Keep route wiring, request handling, validation, and persistence responsibilities separate.
- Never commit secrets from `backend/.env`; verify ignore rules before adding environment-related files.

## Backend Change Checks

- Load environment variables before reading configuration values, and verify the server can start under Node's native ESM resolution.
- Ensure Express JSON parsing is enabled before handlers read `req.body`.
- When changing authentication, keep the Zod schema, controller input handling, and Mongoose user model in agreement, including confirmation fields and required profile data.
- Confirm new users are actually persisted and that password omission/sanitization does not mutate or expose credentials.
- Exercise the affected endpoint or startup path after backend edits because the current package has no automated test suite.

## Documentation

- The only current project documentation is the Vite starter README at [frontend/README.md](frontend/README.md). Update or replace it when adding real frontend setup or usage instructions rather than duplicating those details here.
