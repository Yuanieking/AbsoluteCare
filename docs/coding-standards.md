# Coding Standards and Guidelines

## 1. Code Formatting

- **Readability:** AbsoluteCare uses consistent indentation, spacing and line wrapping so that every layer of the system reads the same way. Both packages use two-space indentation, trailing commas in multi-line literals and argument lists, and native ECMAScript modules (`import`/`export`). Formatting is applied by Prettier in the frontend; the backend follows the same Prettier defaults by convention.
- **Tooling actually configured:**
  - **Frontend:** Prettier 3 is configured in `frontend/.prettierrc.json` (`"semi": false`, `"singleQuote": true`, `"printWidth": 100`, `"trailingComma": "all"`) and run with `npm run format`. ESLint 10 is configured in `frontend/eslint.config.js` with `@eslint/js` recommended rules, `typescript-eslint` recommended rules, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` and `eslint-config-prettier` (so ESLint never fights Prettier over layout). It is run with `npm run lint`.
  - **TypeScript strictness:** `frontend/tsconfig.app.json` enables `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` and `isolatedModules`, and maps the `@/*` alias to `src/*`. Type checking runs through `npm run typecheck` and as the first step of `npm run build` (`tsc -b && vite build`).
  - **Backend:** no formatter or linter is installed in `backend/package.json`. The project guide (`AGENTS.md`) sets Prettier defaults as the convention: double quotes, semicolons and an 80-character line width. Correctness is checked with Node's built-in test runner (`node --test "tests/*.test.mjs"`).
- **Application to AbsoluteCare:**
  - **Backend (Node.js / Express 5, JavaScript ESM):**
    - Code is plain JavaScript run directly by Node (`"type": "module"`, no build step). Local imports always carry an explicit `.js` extension, for example `import { ConflictError } from "../errors/AppError.js";`, because Node's native ESM resolution requires it. Type annotations and JSDoc type tags are not used.
    - **Routes** (`backend/src/routes/`) are flat lists of `router.get/post/patch/delete` calls. Shared middleware chains are grouped into a named array first, such as `const patientOnly = [protectRoute, requirePatient, validateObjectIdParams("id")];` in `patientRoutes.js`.
    - **Controllers** are short exported `async function` handlers that parse the request with a Zod schema, call a service and answer with `res.json(...)` or `res.status(201).json(...)`. Long calls are wrapped one argument per line with a trailing comma.
    - **Services** use guard clauses and early returns instead of deep nesting. Numeric literals use separators for readability (`60_000`, `86_400_000`).
    - **Schemas** (`backend/src/schemas/`) chain Zod refinements vertically when a field has several rules, as in `adminNotificationSchema` (`z.string().trim().min(...).max(...)`).
    - **Models** declare one field per line inside `new mongoose.Schema({...}, { timestamps: true })`, with validation messages written as user-facing sentences ("Enter a valid email address.").
  - **Frontend (React 19 + TypeScript):**
    - Files follow the Prettier configuration: single quotes, no semicolons and a 100-character line width.
    - **TSX elements** with more than one or two props are broken onto separate lines, one prop per line, with the closing `/>` on its own line (see `<Navigate replace to="/login" state={...} />` in `ProtectedRoute.tsx`).
    - **Tailwind CSS 4 utility classes** are written inline in `className`. Long class lists in shared primitives are split into an array and joined, as in the `buttonVariants` definition of `components/ui/button.tsx`, which uses `class-variance-authority` for variants. Conditional classes are merged with the `cn()` helper (`clsx` plus `tailwind-merge`) in `lib/utils.ts`.
    - **Hooks** are called at the top of each component in a stable order (routing, data queries, mutations, then form state), as in `BookAppointmentPage`. The React Hooks ESLint rules enforce this.
    - **Feature modules** import shared code through the `@/` alias (`@/components/ui/button`, `@/lib/api/client`) and sibling files through relative paths (`./queries`, `./schemas`). Type-only imports use `import type` because `verbatimModuleSyntax` is enabled.

## 2. Naming Conventions

- **Descriptive names:** Names describe the clinic concept or action they represent (`listBookingTimes`, `requestReschedule`, `findConflicts`, `useCancelAppointment`), so a reader can follow a booking or payment flow without opening every file.
  - **camelCase** is used for variables, functions, object properties and most backend file names:
    - Backend functions: `bookingTimes`, `availabilityError` and `saveAvailability` in `services/availabilityService.js`; `guardFresh`, `parseIfMatch` and `freshFilter` in `services/concurrencyService.js`; `encryptSecret` and `decryptSecret` in `utils/secretBox.js`.
    - Middleware functions and factories: `protectRoute`, `requireRole`, `requirePermission`, `sanitizeInput`, `securityHeaders`, `createRateLimiter`, `therapistOwnsAppointment`.
    - Zod schemas end in `Schema`: `appointmentRequestSchema`, `rescheduleRequestSchema`, `dependentSchema`, `bookingAvailabilitySchema`. Mongoose schema variables follow the same pattern (`userSchema`, `appointmentSchema`).
    - React hooks start with `use`: `useServices`, `useBookingTimes`, `useBookAppointment`, `usePermission`, `useRecaptcha`, `useDelayedLoading`, `useAuth`, `useSettings`.
  - **PascalCase** is used for React components and pages, TypeScript types, Mongoose model names and error classes:
    - Pages and components: `BookAppointmentPage`, `TherapistAvailabilityPage`, `SecretaryPaymentsPage`, `ProtectedRoute`, `RecordEditors`, `DataTable`, `StatusBadge`.
    - TypeScript types: `Appointment`, `TherapyService`, `DependentInput`, `BookingValues`, `PermissionAction`. Object shapes are mostly declared with `type` aliases; `interface` is used less often.
    - Mongoose models: `User`, `Appointment`, `Session`, `Dependent`, `TherapyService`, `GeneratedDocument`, `AuditLog`, registered with `mongoose.model("GeneratedDocument", ...)`.
    - Error classes in `backend/src/errors/AppError.js`: `AppError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`.
  - **UPPER_SNAKE_CASE** is used for environment variables and module-level constants:
    - Environment variables read in `backend/src/config/env.js`: `PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, `CREDENTIAL_ENCRYPTION_KEY`, `RECAPTCHA_SECRET_KEY`, `BREVO_API_KEY`, `GOOGLE_CLIENT_ID`; on the frontend, `VITE_API_URL`. Values are kept in `backend/.env` and are never committed.
    - Constants: `EDITOR_TTL_MS` (`services/recordConcurrency.js`), `AUDIT_CATEGORIES` (`services/auditCapture.js`), `DOCUMENT_LABELS` (`services/documentNumberService.js`), `WEEKDAYS` (`models/userModel.js`), `APPOINTMENTS_PER_PAGE` (`features/patient/queries.ts`) and `PHONE_ERROR` (`lib/validation.ts`).
  - **File naming patterns:**
    - **Backend:** one suffix per layer, in camelCase: `*Routes.js` (`patientRoutes.js`), `*Controller.js` (`patientController.js`), `*Service.js` (`availabilityService.js`), `*Schema.js` (`appointmentSchema.js`), `*Model.js` (`generatedDocumentModel.js`) and `*Job.js` (`appointmentReminderJob.js`). Middleware files are named after their function (`authMiddleware.js`, `rateLimit.js`, `sanitizeInput.js`). Error classes are the exception, with a PascalCase file (`AppError.js`). Tests use `*.test.mjs` in `backend/tests/`.
    - **Frontend:** page and component files are PascalCase `.tsx` and pages end in `Page` (`BookAppointmentPage.tsx`, `DocumentsPage.tsx`). Feature folders reuse the same fixed module names: `api.ts`, `queries.ts`, `mutations.ts`, `schemas.ts`, `types.ts` and, where needed, `format.ts`. Radix-based primitives in `components/ui/` and chart files in `components/charts/` keep kebab-case names (`alert-dialog.tsx`, `dropdown-menu.tsx`, `bar-chart.tsx`). Some non-component modules also use kebab-case (`nav-config.ts`, `query-client.ts`, `dashboard-path.ts`). Tests sit beside the code they cover as `*.test.ts` or `*.test.tsx`.

## 3. Commenting

- **Inline comments** explain *why* a line exists, not *what* it does. They are short and placed directly above the line they justify, for example `// Express 5 re-parses req.query on every read; pin the parsed value.` in `middleware/validate.js`, or `// A response already started can't be rewritten; let Express close it.` in `errorHandler.js`.
- **Block comments** use the `/** ... */` form as a one- or two-sentence summary above an exported function, without JSDoc type tags (types are not annotated in the backend, and the frontend relies on TypeScript). Examples include `/** NoSQL-injection guard for request bodies and query strings. */` above `sanitizeInput` and `/** Catch-all for requests that matched no route. */` above `notFoundHandler`.
- **Marked comments:** comments about optimistic concurrency start with `// **` so they can be found with a single search across routes, services and the Axios client (for example, `// ** Concurrency: PATCH/DELETE accept If-Match: "<dependent.updatedAt>" -> 409 STALE_RECORD when stale.` in `patientRoutes.js`).
- **Lint suppressions are justified in place:** when an ESLint rule is disabled, the reason is written beside it, as in `router.tsx` (`the route table is a module, not a component file`) and in `RecordEditors.tsx`, where the original record snapshot must not change when background queries refresh.
- **Examples of complex logic that warrants explanation:**
  - **Timestamp concurrency (`If-Match`).** `guardFresh` in `backend/src/services/concurrencyService.js` carries a numbered comment explaining its two-step guard: first fail fast with `409` if the loaded record is already newer than the client's copy, then pin `updatedAt` into the `save()` filter so the write becomes an atomic compare-and-swap. On the client, `frontend/src/lib/api/client.ts` explains why only the newest `updatedAt` per record is kept: "a slow GET must not overwrite a fresher write response."
  - **RBAC permission resolution.** In `authMiddleware.js`, a comment above `requireAccess` states the rule ("admins always pass, other staff roles pass only while the admin has switched the area on in Settings"). The frontend hook `canPerform` in `hooks/usePermission.ts` is documented as mirroring the backend's `requirePermission`, so the two checks are kept in step.
  - **Rate limiting and availability rules.** The block comment on `createRateLimiter` in `middleware/rateLimit.js` explains the in-memory, per-IP fixed window and the `failuresOnly` refund, so only failed logins spend the budget. In `availabilityService.js`, the comment on `availabilityError` records that date overrides take priority and that unset schedules fall back to 08:00–17:00, and `needsSpecialist` explains why a service no specialist covers stays bookable by every therapist.

## 4. Code Structure

- **Backend (`backend/src/`):** a layered structure in which each folder has one responsibility:
  - `app.js`: creates the Express app, registers middleware in order (security headers, audit context, CORS, rate limits, `cookie-parser`, `express.json()`, `sanitizeInput`), mounts the routes, then adds `notFoundHandler` and `errorHandler` last and schedules the background jobs.
  - `/config`: environment loading (`env.js`, the only place `.env` is read), path resolution (`paths.js`), the database connection (`db.js`), cookie and JWT options (`jwtOptions.js`) and integration settings.
  - `/routes`: 20 route modules that wire middleware to controller functions only.
  - `/controllers`: 19 controllers that parse requests with Zod, call services and shape JSON responses.
  - `/services`: business rules and all persistence, with no Express `req`/`res` objects.
  - `/models`: 16 Mongoose models.
  - `/schemas`: Zod 4 request schemas, the single source of truth for request shapes.
  - `/middleware`: cross-cutting guards (authentication, RBAC, scope checks, validation, sanitization, rate limiting, reCAPTCHA, auditing, error handling).
  - `/errors`: the typed `AppError` hierarchy.
  - `/jobs`: background work (`appointmentReminderJob.js`, `documentSyncJob.js`).
  - `/utils`: small shared helpers (`appointmentDates.js`, `jwt.js`, `payments.js`, `secretBox.js`, `validators.js`).
  - `/emails`: email layout, components and templates used by `services/mailer.js`.
  - **Separation by clinic domain:** each domain is a route → controller → service chain.
    - **Authentication and accounts:** `authRoutes.js`, `authController.js`, `authService.js`.
    - **Patient booking and dependents:** `patientRoutes.js`, `patientController.js`, `patientService.js`, `availabilityService.js`.
    - **Therapist workspace:** `therapistRoutes.js`, `therapistController.js`, `therapistService.js`.
    - **Secretary and payments:** `secretaryRoutes.js`, `secretaryController.js`, `secretaryService.js`, `utils/payments.js`.
    - **Administration:** `adminUserRoutes.js`, `adminAppointmentRoutes.js`, `adminServiceRoutes.js`, `adminSpecializationRoutes.js`, `adminRecordRoutes.js` and `adminMonitoringRoutes.js` with their controllers and services.
    - **Documents and verification:** `documentRoutes.js`, `publicVerifyRoutes.js`, `documentService.js`, `documentPdfService.js`, `documentNumberService.js`, `driveService.js`.
    - **Notifications:** `notificationRoutes.js`, `notificationController.js`, `notificationService.js`, `mailer.js`.
    - **Settings and integrations:** `settingsRoutes.js`, `settingsController.js`, `settingsService.js`, `calendarRoutes.js`, `googleDriveRoutes.js`, `integrationCredentialService.js`.
    - **Audit and backups:** `auditRoutes.js`, `auditService.js`, `auditCapture.js`, `backupRoutes.js`, `backupService.js`.
- **Frontend (`frontend/src/`):** a feature-based structure:
  - `/app`: application wiring. `router.tsx` holds the route table, `providers.tsx` the context providers, `nav-config.ts` the role navigation, and `routes/ProtectedRoute.tsx` and `routes/RouteErrorBoundary.tsx` the route guards.
  - `/features/<area>`: one folder per role or domain (`patient`, `therapist`, `secretary`, `admin`, `documents`, `notifications`, `auth`, `audit`, `settings`). The role folders hold their pages plus the same supporting modules; smaller domains keep only the modules they need (`documents/` has `api.ts`, `queries.ts` and `types.ts`):
    - `api.ts`: HTTP calls through the shared Axios client;
    - `queries.ts` and `mutations.ts`: TanStack Query hooks;
    - `schemas.ts`: Zod form schemas;
    - `types.ts`: TypeScript types for the API data.
  - `/components`: reusable UI shared across features:
    - `ui/`: Radix-based primitives such as `button.tsx`, `dialog.tsx` and `select.tsx`;
    - `domain/`: clinic-specific building blocks (`StatusBadge`, `StatTile`, `AppointmentDocket`, `PaymentRecord`);
    - `layout/`: `AppShell`, `StaffLayout`, `PatientLayout`, `Page`;
    - `charts/`: visx-based charts;
    - `form/`: `FormFields`, `AddressInput`, `RecordEditors`;
    - `data-table/`: `DataTable` on TanStack Table;
    - `feedback/`: loaders, skeletons and empty states.
  - `/lib`: framework-independent helpers. `lib/api/` holds `client.ts`, `keys.ts`, `query-client.ts` and `session.ts`; there are also formatting, validation, payment and toast utilities.
  - `/hooks`: cross-feature hooks (`usePermission`, `useRecaptcha`, `useDelayedLoading`, `useCalendarResult`).
  - `/styles`: `tokens.css` (design tokens) and `index.css`.

## 5. Security Practices

- **Environment variables and encrypted credential storage:** secrets such as `JWT_SECRET`, `MONGO_URI`, `RECAPTCHA_SECRET_KEY` and `BREVO_API_KEY` are read only through `backend/src/config/env.js` from `backend/.env`, which is git-ignored; `backend/.env.example` documents the keys without values. Integration credentials and Google Drive refresh tokens stored in MongoDB are encrypted with AES-256-GCM by `encryptSecret` and `decryptSecret` in `utils/secretBox.js`, using a random 12-byte IV and an authentication tag for every value. `calendarService.js` applies the same AES-256-GCM scheme to Google Calendar refresh tokens.
- **Input sanitization and validation:** `middleware/sanitizeInput.js` recursively strips keys that start with `$`, contain `.` or equal `__proto__` from request bodies and query strings, which blocks NoSQL operator injection and prototype pollution. Every request shape is then validated with a Zod schema from `backend/src/schemas/`, either inside the controller with `schema.parse` or through `middleware/validate.js`. `validateObjectId.js` rejects malformed MongoDB IDs in route parameters.
- **HTTP-only JWT cookie authentication:** `utils/jwt.js` issues the signed JWT in a cookie named `session` using `cookieOptions` from `config/jwtOptions.js` (`httpOnly: true`, `secure` and `sameSite: "none"` in production, a one-day lifetime). `cookie-parser` reads it, and `protectRoute` verifies it on every protected request. It also reloads the user, blocks removed or deactivated accounts, and forces a password change when `mustChangePassword` is set. Passwords are hashed with `bcryptjs` before they are saved.
- **Role-based access control and scope checks:** `requireRole`, `requireAccess` and `requirePermission` in `authMiddleware.js` check the user's role and the create/read/update/delete permissions that the administrator configures in Settings. `requirePatient` in `patientMiddleware.js` limits patient routes. `therapistOwnsAppointment` in `appointmentScope.js` answers `404` when a therapist requests an appointment that is not assigned to them, so other patients' visits are not even confirmed to exist. On the frontend, `ProtectedRoute` (`allowedRoles`) and `usePermission` hide screens and actions, but the server-side checks remain the authority.
- **Rate limiting:** `middleware/rateLimit.js` applies a global per-IP ceiling (`globalRateLimit`), a stricter `authRateLimit` for signup and password reset, and a `loginRateLimit` that counts only failed attempts. A separate limiter covers document verification (`verifyRateLimit.js`). Limited requests receive `429` with a `Retry-After` header.
- **Security headers and bot protection:** `securityHeaders.js` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and, in production, `Strict-Transport-Security`; `app.js` also disables `x-powered-by` and allows only configured CORS origins. `verifyRecaptcha.js` verifies Google reCAPTCHA tokens on login, signup, password-reset and Google sign-up completion whenever reCAPTCHA is enabled in Settings.
- **Protection of sensitive fields:** fields that should never leave the server by default use `select: false`, such as the generated PDF buffer in `generatedDocumentModel.js` and the settings edit lease in `appSettingModel.js`. User records are returned through `userSchema.methods.omitPassword`, which removes the password hash, the reset-token hash and encrypted calendar tokens. `errorHandler` answers unexpected failures with a generic `500` message so stack traces never reach the client.
- **Audit logging:** `auditMiddleware.js` (`auditRequest`) opens an `AsyncLocalStorage` context with a request ID for every request, and `protectRoute` attaches the actor's ID, role and name. `auditCapture.js` and `auditService.js` then record who changed which record, and the result, in the persistent `AuditLog` collection shown on the administrator's Audit Log page.

## 6. Backend Best Practices

- **`async/await` with clean error propagation:** controllers and services are written as `async` functions without repetitive `try/catch` blocks. Express 5 forwards rejected promises to the error pipeline automatically, and modules such as `documentRoutes.js` and `publicVerifyRoutes.js` also wrap handlers in a small `asyncRoute` helper. Expected failures are thrown as typed errors from `errors/AppError.js` (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`). `notFoundHandler` answers unmatched routes with `404`, and the central `errorHandler` in `middleware/errorHandler.js` turns each error into one consistent JSON shape:
  - typed errors are sent with their own status and payload;
  - a `ZodError` becomes `400` with field-level `errors`;
  - a stale guarded save (`DocumentNotFoundError`) becomes `409 STALE_RECORD`;
  - anything unknown is logged and answered with a generic `500`.
- **Strict separation of concerns:** controllers never import Mongoose models or `mongoose` itself; every database read and write goes through `backend/src/services/` (for example, `patientController.js` calls `patientService.createDependent` and `availabilityService.bookingTimes`). Services, in turn, never touch Express `req`/`res` objects, so the same rule (such as the availability checks in `availabilityService.js`) can be reused by patient, therapist, secretary and admin controllers and by background jobs.
- **RESTful API conventions:** routes use nouns and HTTP verbs (`GET /dependents`, `POST /dependents`, `PATCH /dependents/:id`, `DELETE /dependents/:id`), with action sub-resources only where an action is not plain CRUD (`POST /appointments/:id/cancel`). Responses are JSON objects keyed by resource (`{ dependent }`, `{ services }`), creation returns `201`, and errors use standard status codes (`400`, `401`, `403`, `404`, `409`, `428`, `429`).
- **Optimistic concurrency control:** writes to shared records use the record's Mongoose `updatedAt` as a version stamp.
  - The client sends the stamp back in an `If-Match` header.
  - `guardFresh`, `freshFilter` and `assertNotStale` in `concurrencyService.js` reject a stale write with `409 STALE_RECORD`.
  - `recordConcurrency.js` requires the header on targeted edit routes, returning `428 PRECONDITION_REQUIRED` when it is missing, and returns `409 RECORD_LOCKED` while another staff member's editor session holds the record.
  - Together, these stop staff from silently overwriting each other's appointments, sessions, dependents and settings.
- **Background job isolation:** scheduled work lives in `backend/src/jobs/` and reuses services instead of duplicating logic. `appointmentReminderJob.js` uses `notificationService.notify` and `settingsService.getSettings`. The jobs are started from `app.js` with `setInterval` (every 15 minutes for reminders, every 5 minutes for document sync), and every run is wrapped in `.catch(...)` so that a failed run is logged without stopping the API.

## 7. Frontend Best Practices

- **Modular, reusable functional components:** all components are function components that use hooks; there are no class components. Screen logic, such as form state, data loading and navigation, stays in feature pages like `BookAppointmentPage`. Reusable presentation lives in `components/` (`PageHeader`, `PageBody`, `TextField`, `SelectField`, `Button`, `StatusBadge`). Props and API data are typed with TypeScript under `strict` mode and `noUncheckedIndexedAccess`, so missing or optional values must be handled explicitly.
- **Utility-first styling:** styling uses Tailwind CSS 4 utility classes, driven by the design tokens in `styles/tokens.css` and the direction set in `DESIGN.md`. Accessible behavior (dialogs, popovers, selects, dropdowns, switches) comes from Radix UI primitives wrapped in `components/ui/`, and variants are declared with `class-variance-authority` rather than ad-hoc class strings. Inline `style` attributes are limited to values that must be computed at runtime, mainly chart geometry in `components/charts/`, skeleton widths and bar heights, and the collapsible rail width variable in `AppShell`.
- **Client-side form validation:** forms use React Hook Form with `zodResolver` and the feature's Zod schema before any request is sent. For example, `BookAppointmentPage` validates against `bookingSchema`, which rejects past dates with `todayInManila()`. The client schemas mirror the backend Zod schemas (both use the same `datePattern` and `timePattern`), and the server still validates every request.
- **Centralized API communication and server-state caching:**
  - **Axios client:** all HTTP traffic goes through the single instance in `frontend/src/lib/api/client.ts`. It sends cookies (`withCredentials: true`), attaches `If-Match` and `X-Editor-Session` headers to writes, handles session expiry, and turns API errors into readable messages through `friendlyErrorMessage`.
  - **TanStack Query:** each feature's `api.ts` functions are wrapped in hooks in `queries.ts` and `mutations.ts`. The hooks use shared query keys from `lib/api/keys.ts`, and a successful mutation invalidates the affected keys (for example, `useBookAppointment` refreshes `keys.appointments.all` and `keys.notifications.all`).
  - **Lazy-loaded, guarded routes:** pages are loaded with `lazy()` in `app/router.tsx` and rendered behind `Suspense` fallbacks (`AppLoader` or `PageSkeletonFallback`). Every portal sits under `ProtectedRoute`, which redirects unauthenticated users to `/login`, enforces `allowedRoles` and checks area access from Settings.
