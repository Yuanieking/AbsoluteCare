# AbsoluteCare QA Report — Passes 1–3 and Fix Re-test

**Environment:** frontend `http://localhost:5173` (Vite, React 19), backend `http://localhost:8080` (Express), run on the `integration` branch.
**Tooling:** `browser-use` 1.0.6 driving its own Chromium (telemetry off), desktop ~1440px and mobile ~390px.
**Dates:** Pass 1 to Pass 3 audit, then the fix and re-test on 2026-11-19.

| Pass | Scope | Account(s) |
|---|---|---|
| 1 | Public site, patient auth, booking, patient dashboard | `jasmine.ocampo.13@gmail.test` |
| 2 | Secretary and therapist portals, role guards | `secretary@absolutecare.test`, `therapist1@absolutecare.test` |
| 3 | Admin portal, appointment lifecycle, Google Calendar connect | `admin@absolutecare.test` |
| Re-test | Every High and Medium bug, across all four roles | All of the above |

**Outcome:** all **6 High** and **10 Medium** bugs are fixed and pass the browser re-test. A second round fixed the four user-visible Low bugs (**L7, L11, L12, L13**), and L10 was fixed as a side effect of M5. The remaining Low items are cosmetic and listed under [Open items](#open-items-low-severity).

---

## 1. Bug report (severity-ranked)

### High

| ID | Pass | Area | Bug | Status |
|---|---|---|---|---|
| H1 | 1 | Backend / all roles | **The rate limiter tripped during normal use.** The per-IP limit of 100 requests per 5 minutes was below what one page view costs (4–8 calls). Logins also counted against the 5-attempt auth limit. | ✅ Fixed |
| H2 | 1 | Frontend auth | **Any `/auth/me` error logged the user out.** A 429, 5xx or network blip cleared the session the same way a real 401 does. | ✅ Fixed |
| H3 | 1 | Booking | **5 of 7 services had no bookable times.** Therapist matching compared specializations against the service *name* (for example "Post-operative Rehabilitation" against "Post-op Rehab") and ignored the service *category*. | ✅ Fixed |
| H4 | 2 | Security / `GET /admin/users` | **User responses exposed credential data:** `resetPasswordTokenHash`, `resetPasswordExpiresAt` and `googleCalendar.refreshTokenEncrypted`. The secretary could read these too, and the secretary and therapist profile endpoints also returned them. | ✅ Fixed |
| H5 | 2 | Secretary payments | **"Record payment" could only mark a visit unpaid.** `toForm()` set `status: 'unpaid'` in record mode, so only a Notes box was shown. | ✅ Fixed |
| H6 | 2/3 | Authorization / `/admin/appointments` | **A therapist could list every pending request in the clinic,** including patient names. They could also confirm, assign, cancel, reschedule, complete or no-show *any* appointment. | ✅ Fixed |

### Medium

| ID | Pass | Area | Bug | Status |
|---|---|---|---|---|
| M1 | 1 | Auth forms | **No validation feedback before the CAPTCHA was ticked.** The submit button was disabled until a token existed, so clicking it did nothing. | ✅ Fixed |
| M2 | 1 | Services data | **"1 minutes" durations** on Neuro Rehabilitation and Pediatric OT. These records were saved before the minimum of 30 minutes was enforced. | ✅ Fixed (data) |
| M3 | 1/2 | All pages | **Raw axios text "Request failed with status code 429"** was shown to users. | ✅ Fixed |
| M4 | 2 | Secretary navigation | **Menu items and route access flipped when `/settings/public` failed,** because the settings provider reset to its restrictive defaults. | ✅ Fixed |
| M5 | 2 | Services, users and records | **Read-only roles saw Add, Edit, Retire, Add user and row action buttons,** all of which the backend rejected with 403. | ✅ Fixed |
| M6 | 2 | Secretary reports | **Generate PDF returned 403.** Clinic reports required `documents:create`, and the "Reports → Create" permission was not checked anywhere. | ✅ Fixed |
| M7 | 2 | Secretary schedule | **The "Upcoming confirmed" filter listed past visits.** The future-only rule applied only when no status was sent. | ✅ Fixed |
| M8 | 2 | Therapist "My patients" | **Account holders with their own appointments were missing.** One row was built per account and labelled with the first dependent found. | ✅ Fixed |
| M9 | 3 | Admin settings | **A failed save said "Please correct the highlighted fields." but highlighted nothing.** The server's per-field `errors[]` were ignored. | ✅ Fixed |
| M10 | 3 | Admin settings audit | **Permission changes rendered as `[object Object] → [object Object]`.** | ✅ Fixed |

### Low

| ID | Pass | Bug | Status |
|---|---|---|---|
| L1 | 1–3 | Generic or stale page titles: "Staff portal", "Clinic today" on Permissions and Audit, "Home" on patient `/profile` and `/settings` | Open |
| L2 | 1 | A past booking date says "No therapist available" instead of a past-date message | Open |
| L3 | 1 | The booking form doesn't say which field is missing | Open |
| L4 | 1 | The verify not-found page is a dead end | Open |
| L5 | 1 | `/reset-password` with no token shows the full form | Open |
| L6 | 1 | The logo is a 306 KB image and is lazy-loaded | Open |
| L7 | 2/3 | The pending queue keeps visits whose time has passed, and staff could still assign or confirm them; "Jan 22" is shown with no year (it is 2030) | ✅ Fixed (round 2) |
| L8 | 2/3 | The "Editing: <your own name>" presence banner shows the current user | Open |
| L9 | 2 | Record session defaults to today instead of the appointment date | Open |
| L10 | 2 | Therapist records triggers a 403 on `GET /admin/specializations` for the secretary | ✅ Fixed (side effect of M5: the catalog loads only for roles that can edit) |
| L11 | 3 | At 390px, the admin Appointments "All services" filter is 478px wide and clipped | ✅ Fixed (round 2) |
| L12 | 3 | Calendar OAuth errors always redirect to the patient page `/settings?calendar=error`, even for therapists | ✅ Fixed (round 2) |
| L13 | 3 | A payment row shows "₱0.00 Fee not set" while Update payment pre-fills ₱1,300; the unpaid-reason text assumes the visit was paid before | ✅ Fixed (round 2) |
| L14 | 3 | Copy issues: "All categorys"; dialog subtitles show the request date; empty "Settings /" breadcrumb | Open |

---

## 2. Fixes applied (root causes)

### Backend (`backend/src`)

| Bug | Change |
|---|---|
| H1 | `middleware/rateLimit.js`: the global limit is now 1,000 requests per 5 minutes per IP. A new `failuresOnly` option refunds requests that finish below 400, and the new `loginRateLimit` uses it so only failed logins count. Signup, forgot-password and reset still count every request (forgot-password always returns 200, so refunds would allow abuse). `routes/authRoutes.js` uses `loginRateLimit` for `/login`. |
| H3 | `services/availabilityService.js`: new `coversService()` matches a therapist's specializations against the service **category** and name, by word stems ("Physical Therapist (PTs)" matches "Physical Therapy"). New `needsSpecialist()` leaves a service that no specialist covers, such as Consultation, open to every therapist instead of unbookable. `controllers/adminAppointmentController.js`, `controllers/patientController.js` and `services/therapistService.js` pass the category through. API responses are unchanged. |
| H4 | `models/userModel.js`: `omitPassword()` now also strips `resetPasswordTokenHash`, `resetPasswordExpiresAt` and `googleCalendar.refreshTokenEncrypted` without changing the document. It is used in `adminUserController.userResponse` and the therapist profile responses; the secretary profile query excludes the same fields. |
| H6 | New `middleware/appointmentScope.js` (`therapistOwnsAppointment`), registered as an `:id` route-parameter guard on `adminAppointmentRoutes` and `adminMonitoringRoutes`. A therapist gets 404 for any appointment not assigned to them. `listAppointments` always filters a therapist's results to their own appointments. Confirm, assign-therapist and available-therapists now require the admin or secretary role. New helper `isAssignedTherapist()` is in `adminAppointmentService`. |
| M6 | `routes/documentRoutes.js`: `POST /documents` checks **`reports:create`** for `type: "clinic_report"` and `documents:create` for every other type. |
| M7 | `services/secretaryService.js`: new explicit `upcoming` status (confirmed and not yet started, combined with any date filter). `confirmed` now returns every confirmed visit, so the front-desk dashboard's "today" view is unchanged. |
| M8 | `controllers/therapistController.js`: one row per person treated, meaning the account holder for their own visits and each dependent for theirs. The last session date is matched per person through the session's appointment. |

### Frontend (`frontend/src`)

| Bug | Change |
|---|---|
| H2 | `features/auth/session.tsx`: only a 401 clears the session. Other errors retry after 1, 3 and 8 seconds and never sign the user out. |
| M1 | `LoginForm`, `SignupForm`, `ForgotPasswordForm`, `GoogleAccountSetupPage`: submit buttons are no longer disabled for a missing CAPTCHA or unchecked terms. The existing schema checks and the inline "Verify reCAPTCHA before continuing." message now appear. |
| M3 | `lib/api/client.ts`: new `friendlyErrorMessage()` in the axios response interceptor replaces `error.message` with the server's message, or a friendly fallback for each status. This covers every page that renders `error.message`. |
| M4 | `features/settings/provider.tsx`: a failed refresh keeps the last known settings instead of resetting to defaults. Until the first load succeeds, it retries every 5 seconds. |
| M5 | New `hooks/usePermission.ts` (`canPerform` / `usePermission`) applies the same rule as the backend's `requirePermission`. It is applied in `ServicesPage` (Add/Edit/Retire), `UsersPage` (Add user, Edit, Activate/Deactivate, Archive, Remove), `PeoplePage` (Edit becomes View, Summary hidden) and `PersonDialog` (read-only mode, no save buttons, no specializations fetch). |
| M5/M6 | `features/documents/GenerateDocumentButton.tsx` hides itself unless the user can create that document type, using the same rule as the server. |
| H5 | `features/secretary/PaymentDialog.tsx`: record mode always starts as **Paid**; only edit mode can move a visit back to unpaid. |
| M7 | `features/secretary/SecretarySchedulePage.tsx`: "Upcoming confirmed" (the default) is distinct from "All confirmed". |
| M9 | New `features/admin/settings/fieldErrors.ts` context. `SettingRow` takes a `field` prop and shows the server's message with a highlighted control. `SettingsPage` maps `errors[]` to fields, scrolls to the first one and clears each error when its field is edited. Every setting row in the clinic, access and operations sections is tagged with its field. |
| M10 | New `features/admin/settings/auditFormat.ts` (`describeChange`) diffs nested values one setting at a time, for example "therapist · appointments · update: Off → On". `AuditLog.tsx` uses it, and the CSV export writes JSON. |

### Round 2: Low-severity fixes (L7, L11, L12, L13)

| Bug | Change |
|---|---|
| L7 | **Backend:** `controllers/adminAppointmentController.js` has a new `pastDueError()`. Assign-therapist, confirm and available-therapists return **409 `REQUEST_PAST_DUE`** when the requested time has passed. **Frontend:** `features/admin/format.ts` adds the year to admin date-times and new `isPastDue()` and `PAST_DUE_REASON`. New `PastDueBadge` and `PastDueCallout` components. In admin Appointments, Assign, Reassign and Confirm are disabled with that reason for past-due requests, and Cancel stays available. The dialogs show the callout instead of the assign form, the admin dashboard shows the badge and disables Confirm, and the secretary schedule shows the badge. `lib/format/patient.ts` (`formatDateTimeManila`) now includes the year, e.g. "Wed, Nov 18, 2026 · 10:00 AM". |
| L11 | `components/domain/FilterBar.tsx`: filter dropdowns are `min-w-0 max-w-full` and fill their row on mobile, capped at 16rem from `sm` up. The fix applies to every page that uses the shared filter bar. |
| L12 | `controllers/calendarController.js`: the callback now redirects by role, sending **therapists to `/staff/therapist/availability`** (where Connect lives) and patients to `/settings`, on success *and* failure. Failures carry a `reason`: `denied` (Google returned `access_denied`), `expired` (bad or expired state), `disabled`, `no_refresh_token` or `failed`. The integration-disabled case now redirects instead of returning raw JSON. For an unverifiable state, an unverified decode only chooses between those two fixed pages. **Frontend:** new `hooks/useCalendarResult.ts` shows a specific message once, then removes `calendar` and `reason` from the URL. It is used by `TherapistAvailabilityPage` and `PatientSettingsPage`. |
| L13 | **Root cause:** unpaid visits store `payment.amount = 0` (nothing collected yet) while the booked fee is in `serviceSnapshot.fee`. The admin table read the 0 (via `??`), the payment dialog read the current service fee (via `||`), and the secretary views ignored the snapshot. **Fix:** one rule, the same one the reports already used: *paid shows what was collected; unpaid shows the booked fee, falling back to a pre-filled amount and then the current fee.* It lives in `backend/src/utils/payments.js` (`visitAmount`, used by the secretary API) and `frontend/src/lib/payments.ts` (`visitAmount`, used by `admin/format.appointmentFee`, both payment dialogs and `secretary/format.paymentAmount`). "Fee not set" now appears only when that amount is really 0. The required "Reason" text depends on whether the visit was paid before (new `unpaidReasonHelp`). |

### Data

| Bug | Change |
|---|---|
| M2 | I updated two services through the admin API (`PATCH /admin/services/:id`, validated and audited), using the durations in `scripts/seed.ts`: Neuro Rehabilitation 1 → **60** min, and Pediatric Occupational Therapy (Ages 1–18) 1 → **45** min. No appointment had a duration of under 30 minutes stored, so no bookings needed repair. |

### Tests added

- `backend/tests/qa-fixes.test.mjs`:
  - H6: a therapist gets 404 on other people's appointments and 403 on confirm or assign of their own.
  - H4: `omitPassword` strips credential fields.
  - H3: category and stem matching, plus the rule that keeps uncovered services open to every therapist.
  - H1: the login limiter counts only failures.
- `frontend/src/features/admin/settings/auditFormat.test.ts`: M10 never prints `[object Object]`.
- Round 2, `backend/tests/qa-fixes.test.mjs`:
  - L7: assign, confirm and available-therapists all return 409 `REQUEST_PAST_DUE`.
  - L12: the therapist denied and expired cases land on `/staff/therapist/availability`; patient and stateless cases land on `/settings`.
  - L13: the backend `visitAmount` rule.
- Round 2, `frontend/src/lib/payments.test.ts`: L13, the frontend `visitAmount` rule.

---

## 3. Validation

| Check | Result |
|---|---|
| `backend: node --test tests/*.test.mjs` | ✅ 50 of 50 pass (43 existing, 4 from round 1, 3 from round 2) |
| `frontend: npm run lint` | ✅ Clean |
| `frontend: npm run build` | ✅ Builds |
| `frontend: npx vitest run` | ✅ 82 of 82 pass. This includes the 3 `auditFormat` tests, the `useRecaptcha` misconfiguration test and 3 `payments` tests. |

**Follow-up (CAPTCHA messages):** an uncommitted edit had changed the `RECAPTCHA_FAILED` message to an admin-facing "Invalid Key…" text, which broke `useRecaptcha.test.ts`.
- **Failed challenge:** a failed or expired CAPTCHA now shows **"CAPTCHA verification failed. Please try again."**
- **Configuration problem:** `backend/src/middleware/verifyRecaptcha.js` now returns a separate `RECAPTCHA_MISCONFIGURED` code (503) when the secret key is missing or Google answers `missing-input-secret` or `invalid-input-secret`. For that code only, `useRecaptcha` shows a configuration message.
- **Server unavailable:** `RECAPTCHA_UNAVAILABLE` keeps its "couldn't verify you right now" message.

---

## 4. Browser re-test results (browser-use, all four roles)

The secretary, therapist and patient sessions ran at the same time in isolated browser profiles. Admin was tested first in the main profile. Each row lists the errors seen during that check. "Induced" means the error was triggered on purpose to prove the fix (a blocked request or an exhausted limiter) and was expected.

| Bug | Role | Re-test | Result |
|---|---|---|---|
| H1 | Admin | 150 back-to-back `GET /settings/public` requests all returned 200 (the old limit failed at 100). Sweeping 8 admin pages afterwards gave **0** errors. | ✅ Pass |
| H2 | Admin | Blocked `/auth/me`, then reloaded `/staff/admin/appointments`. The user stayed on the page during the outage and the session recovered after unblocking. Before the fix, this redirected to `/login`. Errors: 2 induced network failures. | ✅ Pass |
| H3 | Patient | `GET /availability` for each service over the next 7 days: Consultation 7/7 days, Neuro Rehabilitation 5/7, Pediatric OT 2/7 and Complex Care 2/7 (the therapist works Tuesday and Thursday), Physical Therapy 7/7, Post-op 7/7, Sports Injury 7/7. Before the fix, only 2 of 7 services had times. | ✅ Pass |
| H3 | Admin | Available therapists for pending requests: Post-op now offers **Yuanie** and Physical Therapy offers **Noel**; before, no one was offered for either. | ✅ Pass |
| H4 | Admin, secretary | `GET /admin/users` (28 users) and `/secretary/profile` contain 0 `resetPasswordTokenHash`, `resetPasswordExpiresAt`, `refreshTokenEncrypted` or `password` fields. | ✅ Pass |
| H5 | Secretary | `/staff/secretary/payments` → Record payment on an unpaid visit shows **Amount (₱1,200 pre-filled), Payment method, Reference number and Notes**. An empty submit shows paid-path validation ("Enter an amount greater than zero.", "A reference number is required…"). Not submitted. | ✅ Pass |
| H6 | Therapist | `GET /admin/appointments?status=pending` returns **0** rows (it was 9 clinic-wide); history shows only their own visits. On another therapist's appointment (Mara's) and on an unassigned request, GET, confirm, assign-therapist, cancel, reschedule, available-therapists, complete and no-show all return **404** (probes). Their own appointment's detail still loads (200) and the therapist UI works. | ✅ Pass |
| M1 | Logged out | On `/login`, `/signup` and `/forgot-password` the submit button is enabled. An empty submit shows field errors; a filled form without the CAPTCHA shows "Verify reCAPTCHA before continuing." and sends no request. | ✅ Pass |
| M2 | Admin, patient | Durations show 60 and 45 min on the services page and the patient booking page; there are no "1 minutes" labels. | ✅ Pass |
| M3 | Logged out | The public verify limiter was exhausted (induced 429). `/verify/QA-TEST-000` shows "We could not check this document. Too many requests. Retry in 1 minute(s)." with no raw status-code text. | ✅ Pass |
| M4 | Secretary | Blocked `/settings/public` and triggered 3 refreshes. The menu stayed at **12/12** items, and Services, Users, Reports and Settings all stayed reachable. Errors: 3 induced network failures. | ✅ Pass |
| M5 | Secretary | Services has no Add, Edit or Retire buttons. Users has no Add user button, and the row menu offers **View** only. Patient and therapist records show View, and the dialog is titled "View patient record" with no save buttons. | ✅ Pass |
| M5 | Therapist | Services has no write buttons. Session-record Edit is still shown, which is correct because the therapist has sessions update permission. | ✅ Pass |
| M6 | Secretary | Generate PDF is shown, and `POST /documents {type:"clinic_report"}` passes the permission check: it returned 400 for a deliberately invalid date range, chosen so no permanent document was created. `patient_summary` is still 403 and its Summary button is hidden. | ✅ Pass |
| M7 | Secretary | The default "Upcoming confirmed" filter shows 4 visits (Nov 23 to Dec 3) and **0 in the past**; before, it listed Sep 16, Sep 22, Sep 25 and Nov 3. "All confirmed" still returns all 25. | ✅ Pass |
| M8 | Therapist | My patients lists **Jeff Ivan Mayor** and **Rogelio Dela Cruz** as patients in their own right, plus their dependents (Juan Mayor-1 and Miguel Dela Cruz-1): 11 people in total. | ✅ Pass |
| M9 | Admin | Saved an invalid clinic email. The Email row is highlighted with "Invalid email address" (red border, `role=alert`), the toast says "Please correct the highlighted fields.", and the highlight clears on edit. Discarded; saved settings are unchanged. | ✅ Pass |
| M10 | Admin | The settings audit shows "therapist · appointments · create: Off → On; … update: Off → On", and there is no `[object Object]` anywhere. | ✅ Pass |
| L10 | Secretary | Therapist records no longer requests specializations, so there is no 403. | ✅ Pass |
| L7 | Admin | Appointments → Pending shows dates with years ("Nov 18, 2026, 10:00 AM", "Jan 22, 2030, 10:31 AM"). The Nov 18 request shows a **Past due** badge and **Assign is disabled**; future requests keep Assign enabled. The Review dialog shows "Past due. The requested time has already passed…" with **Assign therapist disabled**. The dashboard shows the badge and **Confirm is disabled**. | ✅ Pass |
| L7 | Admin (API) | On the past-due request, `PATCH …/assign-therapist` and `GET …/available-therapists` both return **409 `REQUEST_PAST_DUE`**. Confirm returns 400 because no therapist is assigned, which is checked first; the 409 path for confirm is covered by the backend test. | ✅ Pass |
| L7 | Secretary | Schedule → Pending shows "Wed, Nov 18, 2026 · 10:00 AM … Pending **Past due**". | ✅ Pass |
| L11 | Admin, secretary at 390px | No element extends past the viewport and `scrollWidth` stays 390 on admin Appointments, Users, Payments, Sessions, Services and Audit, and on secretary Schedule and Payments. The admin "All services" filter now ends at 370px (it was 498px). | ✅ Pass |
| L12 | Therapist | Replayed Google's denial redirect (`/integrations/google-calendar/callback?state=<signed therapist state>&error=access_denied`). It lands on **`/staff/therapist/availability`**, the query string is removed, the toast says "Google Calendar was not connected because access was declined. Connect again and allow calendar access.", and the session stays signed in. A forged or expired therapist state also lands there, with "The Google Calendar sign-in link expired. Click Connect to try again." With curl, a patient or stateless callback redirects to `/settings?calendar=error&reason=expired`. There were no 500s. | ✅ Pass |
| L13 | Admin, secretary | For Emmanuel Garcia's Neuro Rehabilitation visit on Nov 30 (unpaid, `payment.amount` 0, booked fee ₱1,300), every view shows **₱1,300.00**: the admin Payments table (no "Fee not set" on any row), the admin Update payment dialog ("₱1,300.00 expected"), the secretary schedule row ("Unpaid ₱1,300.00"), the secretary detail view, the secretary Record payment dialog ("₱1,300.00 expected", amount pre-filled 1300) and the secretary API (`payment.amount: 1300`). The admin Unpaid reason help now reads "Required — note why payment is still outstanding." Nothing was saved. | ✅ Pass |

### Regression sweeps (no unexpected console errors or 4xx/5xx)

| Role | Pages | Errors |
|---|---|---|
| Admin | Overview, Appointments, Users, Services, Payments, Reports, Audit, Settings. Admin confirm and assign still reach the handler (404 for a made-up ID). | 0 |
| Secretary | Front desk, Schedule, Payments, Services, Sessions, Patients, Therapists, Reports, Users, Notifications, Settings, Profile, My activity, Documents (14 pages) | 0 |
| Therapist | My day, My appointments plus a detail page, My patients, Services, Session records, Availability, Notifications, Settings, Profile, My activity, Documents (11 pages) | 0 |
| Patient | Dashboard, Appointments, Book, Progress, Dependents, Notifications, Profile, Settings (8 pages) | 0 |

The only 4xx responses seen during the re-test were deliberate:
- the induced 429s and blocked requests above;
- the H6 404 probes and the M6 400 and 403 probes;
- the M9 400, which is the validation being tested;
- the 401 on `/auth/me` while logged out, which is how the app detects a signed-out user.

---

## 5. Pass 3 recap (admin portal, before the fixes)

- **Logged out:** all 17 admin routes redirect to `/login`, and all 11 admin APIs return 401.
- **Role guards:** an admin is redirected away from secretary, therapist and patient routes.
- **QA-TEST appointment lifecycle (`6afdbe883b22453ac5b34bb9`):** assigned to therapist1 → confirmed (10:00 Manila stored correctly) → rescheduled to Nov 28 11:00 → **cancelled**. Each step persisted across a reload.
  - Validation passed: assign requires a therapist; reschedule rejects past dates and times outside the therapist's hours; cancel requires a reason and notes; mark completed and no-show are disabled before the session.
  - The appointment remains in History as Cancelled; there is no delete endpoint.
- **Google Calendar:** the connect endpoints are restricted to patients and therapists (admin gets 403, with no 500). The OAuth callback answers a missing, invalid or denied request with a 302 to `/settings?calendar=error`, with no crash.
  - Not tested: the real redirect to Google's consent page, which needs a therapist session and a Google account.
- **Mobile at 390px:** no page overflows except L11 (fixed in round 2); dialogs fit the screen.

---

## 6. Test data and state changes

| Change | State |
|---|---|
| Pass 1 QA-TEST appointment `6afdbe883b22453ac5b34bb9` | **Cancelled** in Pass 3 (reason "QA-TEST cleanup"); still in History |
| Pass 2 availability override (31 Dec day off) | Added and then removed; `dateOverrides` is `[]` |
| Service durations (M2) | Neuro Rehabilitation 60 min, Pediatric OT 45 min (audited admin edits) |
| Clinic settings | Unchanged (invalid saves were rejected, drafts discarded) |
| Payments, session records, users, documents | None created or changed (H5, M6 and L13 were verified without saving) |
| Calendar connections | None. L12 replayed the callback with `error=access_denied`, so no Google tokens were exchanged |
| Rate-limit counters | In-memory only; they reset when the backend restarts |

## Open items (Low severity)

The remaining items are minor and cosmetic: **L1** (generic page titles), **L2** (past-date booking message), **L3** (booking form hint), **L4** (verify not-found dead end), **L5** (reset-password page without a token), **L6** (logo size), **L8** (presence banner shows your own name), **L9** (Record session date default) and **L14** (copy issues).

**Policy note (H3):** a service whose category no therapist specializes in, today only **Consultation**, is now open to every active therapist. If the clinic wants specialist-only consultations, give one or more therapists a "Consultation" specialization and it becomes specialist-only automatically.
