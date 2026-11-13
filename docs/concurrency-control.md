# Concurrency Control

## What it does

Concurrency control helps stop people from accidentally overwriting each other's changes. For example, if two admins open the same appointment and one saves a change, the other person's older copy can be rejected instead of replacing the newer information.

The app compares the record's last-updated time (`updatedAt`) with the time the person last received. If they don't match, the server returns a **409 conflict**. The app then asks for fresh data, and the user can review it and try again. This check does not lock the record.

## Where to find the code

### Main pieces

- `backend/src/services/concurrencyService.ts` — The main checks. It reads the `If-Match` header, compares timestamps, and detects changes made while a save is underway.
- `backend/src/errors/AppError.ts` — Defines the `STALE_RECORD` conflict error.
- `backend/src/middleware/errorHandler.ts` — Converts a failed guarded save into a conflict response.
- `backend/src/app.ts` — Allows browsers to send the `If-Match` header.
- `frontend/src/lib/api/client.ts` — Remembers record timestamps, adds them to supported requests, and asks the app to refresh data after a conflict.

### Features using the checks

All paths below start with `backend/src/`. Routes identify the endpoints; controllers and services contain the checks.

- **Admin appointments:** `routes/adminAppointmentRoutes.ts` and `controllers/adminAppointmentController.ts`.
- **Appointment monitoring and payments:** `routes/adminMonitoringRoutes.ts`, `controllers/adminMonitoringController.ts`, and `controllers/secretaryController.ts`.
- **Secretary profile and payments:** `routes/secretaryRoutes.ts`, `controllers/secretaryController.ts`, and `services/secretaryService.ts`.
- **Therapist profile, availability, and sessions:** `routes/therapistRoutes.ts`, `controllers/therapistController.ts`, and `services/therapistService.ts`.
- **Admin users and records:** `routes/adminUserRoutes.ts`, `routes/adminRecordRoutes.ts`, `controllers/adminUserController.ts`, and `services/adminUserService.ts`.
- **Own account:** `routes/authRoutes.ts`, `controllers/authController.ts`, and `services/authService.ts`.
- **Therapy services:** `routes/adminServiceRoutes.ts` and `controllers/adminServiceController.ts`.
- **Settings:** `routes/settingsRoutes.ts` and `services/settingsService.ts`.
- **Dependents:** `routes/patientRoutes.ts` and `services/patientService.ts`.
- **Individual notifications:** `routes/notificationRoutes.ts`, `routes/patientRoutes.ts`, `services/notificationService.ts`, and `services/patientService.ts`.

Look for `// **` comments in the routes and check sites for more details.

### Background updates

Some automatic updates deliberately do not change `updatedAt`, so they do not cause unnecessary conflict warnings:

- `backend/src/jobs/appointmentReminderJob.ts` — Tracks sent reminders.
- `backend/src/services/calendarService.ts` — Stores Google Calendar event IDs.
- `backend/src/services/settingsService.ts` — Stores integration test results.

When adding a background update, consider whether users should be warned about that change before using `timestamps: false`.

## How a check works

1. The frontend receives a record and remembers its `updatedAt` value.
2. For supported `PATCH` and `DELETE` requests, it sends that value in an `If-Match` header.
3. The backend compares it with the current record. If it matches, the change can proceed. If it is outdated, the backend returns `409` with the code `STALE_RECORD`.
4. The frontend requests fresh data. The user can review it and retry their change.

A missing `If-Match` header, or the value `*`, skips the check for compatibility with older clients. An invalid timestamp returns `400`. The frontend sends a timestamp only when it can identify the record and has previously seen its timestamp.

## Exceptions and limits

- Bulk notification actions, such as marking all as read, do not use a single-record timestamp check. See `backend/src/routes/notificationRoutes.ts` and `backend/src/routes/patientRoutes.ts`.
- The integration credentials endpoint updates multiple records and has its own confirmation flows. See `backend/src/routes/settingsRoutes.ts`.
- Settings endpoints have no record ID in their URLs, so the frontend does not automatically send `If-Match` for them, although the backend accepts it. All settings sections share one record, so changes to different sections can conflict when the check is used.
- Timestamps have millisecond precision, so two changes within the same millisecond may not be distinguished. A version counter would be an alternative if this becomes a problem.
- Because the check is optional, requests without a timestamp can still overwrite changes.

## Checking the behavior

The check script is `backend/scripts/concurrencyCheck.ts`. It needs a running MongoDB connection and a seeded active admin; it creates and later deletes a temporary therapy service. From the backend directory, run:

```bash
npm run build
npx tsx scripts/concurrencyCheck.ts
```

The script checks successful updates, outdated timestamps, invalid or missing headers, deletion, and browser permission to send the header.
