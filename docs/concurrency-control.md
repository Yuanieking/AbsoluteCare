# Concurrency Control (Timestamp / Optimistic)

## Purpose

Several people can edit the same record at the same time. For example, two admins can open the same appointment, a secretary can update a payment while an admin cancels the visit, or the same profile can be open in two tabs. Before this change every write followed a load, change, `save()` pattern with no check, so **the last write silently overwrote the earlier one** (a "lost update").

Timestamp concurrency control stops that. Each record already has a Mongoose `updatedAt` timestamp (`timestamps: true` on every model). The client sends back the `updatedAt` it last read, and the server only applies the write if the record still has that exact timestamp. If someone else changed the record in between, the write is rejected with **409 Conflict** and nothing is overwritten.

This is _optimistic_ concurrency control. Nothing is locked, so reads and writes stay fast, and conflicts are detected at write time.

## Contract

| Request                                                 | Result                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `If-Match: "<updatedAt ISO string>"` matches the record | Write applied (normal response)                                                                               |
| `If-Match` is older than the record                     | `409 { "code": "STALE_RECORD", "message": "This record was changed by someone else. Reload and try again." }` |
| No `If-Match` header (or `*`)                           | Write applied unchecked, as before (opt-in, so older clients keep working)                                    |
| `If-Match` is not a valid date                          | `400 { "message": "If-Match must be the record's updatedAt timestamp." }`                                     |

Example:

```http
PATCH /admin/appointments/66f0c0ffee0000000000abcd/confirm
If-Match: "2026-11-08T09:12:44.512Z"
```

Response bodies are unchanged. The timestamp the client needs is already in every record it receives (`updatedAt`).

## Where the code lives

### Core (backend)

- `backend/src/services/concurrencyService.ts` holds the whole mechanism:
  - `parseIfMatch(header)` reads the header into a `Date`. It returns `undefined` when the header is missing (no check) and gives a 400 for a malformed value.
  - `guardFresh(doc, ifMatch)` is used for **load, change, `save()`** writes, in two steps:
    1. It fails fast with a 409 if the loaded document is already newer than what the client saw.
    2. It adds `updatedAt` to the document's `$where`, so the following `save()` is an **atomic compare-and-swap**. If another write lands between the load and the save, the save matches nothing, Mongoose throws `DocumentNotFoundError`, and that becomes a 409. The added filter is removed after the first successful save, so follow-up saves in the same request (for example calendar sync) are not blocked by our own write.
  - `freshFilter(ifMatch)` returns `{ updatedAt }` to spread into the filter of **single-statement writes** (`findOneAndUpdate`, `deleteOne`).
  - `assertNotStale(ifMatch, exists)` runs after a `freshFilter` write matched nothing. It returns 409 if the record still exists (stale timestamp); otherwise the caller returns its normal 404.
- `backend/src/errors/AppError.ts` defines the `ConflictError` class (409, `code: "STALE_RECORD"`).
- `backend/src/app.ts`:
  - The global error handler maps `DocumentNotFoundError` (a failed guarded `save()`) to `ConflictError`.
  - The CORS `allowedHeaders` setting includes `If-Match`. Without it, browsers block every guarded request in the preflight.

### Where it is applied

Controllers read the header with `req.get("If-Match")` and either call `guardFresh` on the document they loaded or pass the header to the service, which uses `freshFilter`. Every guarded route and check site is marked with a `// **` comment.

| Area                                                                                                                        | Routes file                                                | Check sites                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Admin appointments (assign, confirm, reschedule, approve/decline request, cancel)                                           | `routes/adminAppointmentRoutes.ts`                         | `controllers/adminAppointmentController.ts` (`guardFresh`)                                                                     |
| Admin monitoring (complete, no-show, payment)                                                                               | `routes/adminMonitoringRoutes.ts`                          | `controllers/adminMonitoringController.ts`, `controllers/secretaryController.ts`                                               |
| Secretary (profile, payment)                                                                                                | `routes/secretaryRoutes.ts`                                | `controllers/secretaryController.ts`, `services/secretaryService.ts` (`freshFilter`)                                           |
| Therapist (profile, availability, no-show, session notes)                                                                   | `routes/therapistRoutes.ts`                                | `controllers/therapistController.ts`, `services/therapistService.ts`                                                           |
| Admin users and records (edit, archive, activate/deactivate, remove, patient/therapist edits, specialization, availability) | `routes/adminUserRoutes.ts`, `routes/adminRecordRoutes.ts` | `controllers/adminUserController.ts`, `services/adminUserService.ts`                                                           |
| Own account (profile, notification preferences, change password)                                                            | `routes/authRoutes.ts`                                     | `controllers/authController.ts`, `services/authService.ts`                                                                     |
| Therapy services (edit, retire)                                                                                             | `routes/adminServiceRoutes.ts`                             | `controllers/adminServiceController.ts`                                                                                        |
| Settings (section save, integration toggle)                                                                                 | `routes/settingsRoutes.ts`                                 | `services/settingsService.ts` (upsert is turned off while guarded, so a stale filter cannot create a second settings document) |
| Dependents (edit, remove)                                                                                                   | `routes/patientRoutes.ts`                                  | `services/patientService.ts`                                                                                                   |
| Single notifications (read, unread, delete)                                                                                 | `routes/notificationRoutes.ts`, `routes/patientRoutes.ts`  | `services/notificationService.ts`, `services/patientService.ts`                                                                |

All paths above are relative to `backend/src/`.

### Intentionally not guarded

Each of these has a `// **` comment in its routes file:

- "Mark all read" and "clear read" notifications (`PATCH /notifications/read-all` and `DELETE /notifications` in `notificationRoutes.ts`, plus the patient `read-all` route in `patientRoutes.ts`) are bulk writes, so there is no single record timestamp.
- `PATCH /admin/settings/integrations/credentials` writes several credential records in one request and already has its own 409 confirmation flows.

### Background writes that must not change `updatedAt`

Bookkeeping writes use `timestamps: false`. Otherwise they would make a user's next guarded edit fail with a false 409:

- `backend/src/jobs/appointmentReminderJob.ts`: the reminder job marking a window as sent.
- `backend/src/services/calendarService.ts`: storing Google Calendar event ids after confirm, reschedule or cancel.
- `backend/src/services/settingsService.ts` (`saveIntegrationTestResult`): saving integration test results.

When you add a new background job or side-effect write to a guarded model, give it `timestamps: false` unless the change is something a user should be warned about.

### Frontend

`frontend/src/lib/api/client.ts` (axios instance) handles this for the whole app, so pages and API functions need no changes:

- **Response interceptor:** It remembers the newest `updatedAt` seen for every record `_id` in any response body (lists, details, write responses). It keeps the newest value only, so a slow GET cannot overwrite a fresher one.
- **Request interceptor:** On `PATCH`/`DELETE` it takes the record id from the URL (24-hex ObjectId) and sends `If-Match` with the remembered timestamp. Own-account routes without an id (`/auth/profile`, `/therapist/availability`, ...) use the signed-in user's id, which comes from `/auth/*` responses.
- **On `409 STALE_RECORD`:** It calls `queryClient.invalidateQueries()` so the screen refetches the latest data, and the page shows the server's message through its usual `getToastError` toast. The user reviews the fresh data and tries again.

Settings routes have no id in the URL, so the frontend does not send `If-Match` for them. The backend still accepts it.

## Verifying it

```bash
cd backend
npm run build
npx tsx scripts/concurrencyCheck.ts
```

`backend/scripts/concurrencyCheck.ts` uses the configured MongoDB (it needs one active, seeded admin) and a temporary therapy service that it deletes afterwards. It starts the compiled server and checks:

- The second of two writers who read the same version is rejected, and the first writer's own follow-up save still works.
- A stale atomic write returns 409.
- The CORS preflight allows `If-Match`.
- `PATCH` with a stale timestamp returns 409, the current one returns 200, replaying the old one returns 409, no header returns 200 and a malformed header returns 400.
- `DELETE` with a stale timestamp returns 409.

Manual check with curl, given a valid `session` cookie:

```bash
curl -i -X PATCH http://localhost:8080/admin/services/<id> \
  -H 'Content-Type: application/json' \
  -H 'If-Match: "2000-01-01T00:00:00.000Z"' \
  -b 'session=<token>' -d '{"fee":5}'
# -> HTTP/1.1 409 Conflict  {"code":"STALE_RECORD",...}
```

## Limits and upgrade paths

- **Millisecond resolution:** Two writes in the same millisecond have the same `updatedAt` and can't be told apart. If that ever matters, switch to a version counter (Mongoose `optimisticConcurrency` / `__v`).
- **Opt-in:** Writes without `If-Match` are not checked. Once every client sends it, the server can require it (return `428 Precondition Required` when the header is missing).
- **Document-wide timestamp for settings:** All settings sections live in one document, so saving section A after someone saved section B is reported as a conflict.
