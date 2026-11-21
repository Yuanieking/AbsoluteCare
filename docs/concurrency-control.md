# Concurrency Control

> For a deeper, step-by-step walkthrough of the logic, see [timestamp-concurrency-explained.md](timestamp-concurrency-explained.md).

## What problem does it solve?

Two people open the same record. Person A saves a change. Then Person B saves their change, but B's screen still shows the **old** data, so B's save quietly wipes out A's work.

Concurrency control prevents this in two ways:

1. **Edit lock:** while one person is editing a record, other people can view it but can't edit it.
2. **Timestamp check:** if a save would still overwrite someone else's newer change, the server rejects it with a **409 conflict** and the user's typed input is kept.

---

## The main idea in one sentence

Every record has an `updatedAt` time. The browser sends back **the `updatedAt` it saw when the form was opened**, and the server saves **only if the record still has that same time**.

```
Browser:  "I'm editing the version from 10:00:00.000. Save this."
Server:   Record is still 10:00:00.000?  → Yes → save, new time 10:00:10.000
                                          → No  → 409 "This record was changed by someone else"
```

The time is sent in the standard `If-Match` request header:

```
If-Match: "2026-11-19T10:00:00.000Z"
```

---

## How it works, step by step

### In the browser (`frontend/src/lib/api/client.ts`)

1. **Remember.** Every API response is scanned. For each record (`_id` + `updatedAt`), the browser remembers the **newest** `updatedAt` it has seen.
2. **Pin.** When an edit form opens, it **pins** the timestamp from that moment.
   *Why?* The page refreshes data in the background. If someone else saves while you're typing, the browser learns a newer timestamp. Sending that newer one would let your save overwrite their change, so the form keeps sending the timestamp it started with.
3. **Send.** On every `PATCH / PUT / POST / DELETE`, the browser adds:
   - `If-Match`: the pinned timestamp, or the latest one it saw if nothing is pinned
   - `X-Editor-Session`: a random id for this browser tab (used by the edit lock)
4. **On conflict (409).** A message appears: *"This record changed. Your input is preserved."* Your draft is **not** merged with the new data automatically. Copy your changes, reopen the form, review the latest data, and save again.

### On the server (backend)

The server checks in three layers. Each layer catches something the others might miss.

**Layer 1: guards inside each handler** (`services/concurrencyService.js`)

| Helper | When it's used | What it does |
|---|---|---|
| `guardFresh(doc, ifMatch)` | Load a record, change it, `save()` | Rejects right away if the loaded record is already newer. Then adds `updatedAt` to the save condition, so the database only saves if nobody changed the record in the meantime. |
| `freshFilter(ifMatch)` | One-step updates/deletes (`findOneAndUpdate`, `updateOne`, `deleteOne`) | Adds `updatedAt: <expected>` to the query, so the version check and the write are one operation. |
| `assertNotStale(ifMatch, exists)` | After a one-step write matched nothing | Checks why it failed: the record still exists → **409** (it was changed); the record is gone → **404**. |

The check and the save happen in **one database operation**:
`update WHERE _id = 42 AND updatedAt = <what you saw>`.
There's no gap between them where another save could sneak in.

**Layer 2: automatic guard on every model** (`services/recordConcurrency.js`)

Layer 1 only works where a developer remembered to add it. Layer 2 is a Mongoose plugin (registered in `config/audit.js`) that protects the edited record **automatically**.

- `app.js` stores three things for each request: *which record the URL is editing*, the `If-Match` value, and the editor session. This uses `AsyncLocalStorage`, which acts like a global variable that exists only for the current request.
- `recordTarget()` reads the URL to find the record being edited, for example `/admin/appointments/<id>` → `Appointment:<id>`. Only that record is guarded. Other documents the request touches, such as notifications or audit logs, are left alone.
- For that record, the timestamp is **required**. A save without `If-Match` gets **428** ("Reload this record before saving").
- Each save gets a new time of **at least the old time + 1 millisecond**. Two quick saves can therefore never end up with the same timestamp.
- `upsert` is turned off for guarded updates. Otherwise a failed match could **create a duplicate** record.
- If the same request saves the record twice, the second save expects the new time from the first save, so the request doesn't conflict with itself.

**Layer 3: edit lock / "who's editing"** (`services/recordEditorsService.js`, `frontend/src/components/form/RecordEditors.tsx`)

- While a form is open, the browser sends a heartbeat (`PUT /record-editors/<kind>/<id>`) every **15 seconds**, or every **3 seconds** while it waits for the lock.
- An editor that misses heartbeats for **45 seconds** is treated as gone, so a closed tab can't keep a lock forever.
- **The first person who opened the record holds the lock.** Everyone else sees *"<Name> is editing this record"* and can view the form but not edit it.
- The server enforces the lock too: saves from other tabs get **409 RECORD_LOCKED**.
- When the holder closes the form, the next person gets a message to review the latest details before saving.

> The lock is a convenience that stops most clashes early. The timestamp check is what **guarantees** nothing gets overwritten.

---

## Response codes

| Code | `code` field | Meaning | What the user should do |
|---|---|---|---|
| 400 | — | `If-Match` isn't a valid timestamp | Bug in the client; reload |
| 409 | `STALE_RECORD` | Someone changed the record after you opened it | Copy changes, reopen, review, save |
| 409 | `RECORD_LOCKED` | Someone else is editing it right now | Wait for them to finish |
| 428 | `PRECONDITION_REQUIRED` | The save had no timestamp | Reload the record, then save |

---

## Where to find the code

### Main pieces

| File | Role |
|---|---|
| `backend/src/services/concurrencyService.js` | Reads `If-Match`; `guardFresh`, `freshFilter`, `assertNotStale` (Layer 1) |
| `backend/src/services/recordConcurrency.js` | Request context, `recordTarget`, automatic plugin, lock check (Layer 2) |
| `backend/src/config/audit.js` | Registers the plugin on all models |
| `backend/src/app.js` | Creates the per-request context; allows the `If-Match` and `X-Editor-Session` headers from the browser (CORS) |
| `backend/src/errors/AppError.js` | `ConflictError` → 409 `STALE_RECORD` |
| `backend/src/middleware/errorHandler.js` | Turns a failed guarded `save()` (`DocumentNotFoundError`) into a 409 |
| `backend/src/services/recordEditorsService.js` | Stores who is editing and decides who holds the lock (Layer 3) |
| `frontend/src/lib/api/client.ts` | Remembers and pins timestamps, adds headers, reacts to 409 |
| `frontend/src/components/form/RecordEditors.tsx` | Heartbeat, lock banner, read-only form, "record changed" message |

### Features using the checks

All paths start with `backend/src/`.

- **Admin appointments:** `routes/adminAppointmentRoutes.js`, `controllers/adminAppointmentController.js`
- **Appointment monitoring and payments:** `routes/adminMonitoringRoutes.js`, `controllers/adminMonitoringController.js`, `controllers/secretaryController.js`
- **Secretary profile and payments:** `routes/secretaryRoutes.js`, `controllers/secretaryController.js`, `services/secretaryService.js`
- **Therapist profile, availability, and sessions:** `routes/therapistRoutes.js`, `controllers/therapistController.js`, `services/therapistService.js`
- **Admin users and records:** `routes/adminUserRoutes.js`, `routes/adminRecordRoutes.js`, `controllers/adminUserController.js`, `services/adminUserService.js`
- **Own account:** `routes/authRoutes.js`, `controllers/authController.js`, `services/authService.js`
- **Therapy services:** `routes/adminServiceRoutes.js`, `controllers/adminServiceController.js`
- **Settings:** `routes/settingsRoutes.js`, `services/settingsService.js`
- **Dependents:** `routes/patientRoutes.js`, `services/patientService.js`
- **Individual notifications:** `routes/notificationRoutes.js`, `routes/patientRoutes.js`, `services/notificationService.js`, `services/patientService.js`

Look for `// **` comments in these files for details.

---

## Background updates that don't count as "changes"

Some automatic updates use `{ timestamps: false }`, so they **don't change `updatedAt`**. These are system bookkeeping, not user edits, and they shouldn't cause false "someone changed this" warnings:

- `backend/src/jobs/appointmentReminderJob.js`: marks reminders as sent
- `backend/src/services/calendarService.js`: stores Google Calendar event IDs
- `backend/src/services/settingsService.js`: stores settings edit-lease bookkeeping and integration test results

When you add a background update, decide whether users should be warned about it. If they shouldn't, use `timestamps: false`.

---

## Limits to keep in mind

- **Only the record named in the URL is strictly protected.** On routes that `recordTarget()` doesn't recognize, the timestamp is optional, so a request without `If-Match` can still overwrite.
- **Bulk actions** such as "mark all notifications as read" don't use a single-record check.
- **The integration credentials endpoint** updates several records and has its own confirmation steps (see `routes/settingsRoutes.js`).
- **All settings live in one record.** Saving one settings section can conflict with someone saving a different section.
- **Timestamps have millisecond precision.** The "+1 ms" rule keeps them increasing. If that ever isn't enough, a version counter would be the stricter alternative.
- **The lock check and the save are separate steps.** In the rare gap between them, the timestamp check still blocks any overwrite.

---

## Testing it

From the `backend` directory:

```bash
# Unit tests (includes tests/record-concurrency.test.mjs)
node --test tests/

# End-to-end check against a real database
npx tsx scripts/concurrencyCheck.ts
```

The end-to-end script needs a working MongoDB connection and an active admin (`npm run seed`). It starts the server, creates a temporary therapy service, and then checks:
- normal saves
- outdated timestamps
- invalid and missing headers
- deletes
- that the browser is allowed to send the header

It deletes the temporary service when it finishes.
