# API documentation audit: change log

- **Source:** `docs/API_DOCUMENTATION (1).docx` (unchanged).
- **Output:** `docs/API_DOCUMENTATION_REVISED.docx`.
- **Generator:** none. Nothing in `scripts/` or `backend/scripts/` builds this document, so the `.docx` XML was edited directly. Only `word/document.xml` changed; the other 322 package entries are byte-identical, including all 307 media files and the 308 image blocks.

**Structure after the edit:**
- Modules: 1.0 (new) plus 1.1–1.20.
- Endpoint sections: 152.
- Figures: 1–304, sequential, with no gaps or duplicates.
- Response tables: 152, all in ascending code order.

**How it was verified:**
- Code-dependent items were checked against `backend/src` on branch `integration` (routes, middleware, Zod schemas, controllers and services).
- For every "Invalid Request" figure (156 image blocks), I read the status line and response body in the screenshot. Each caption now states the status the screenshot actually shows.
- `docs/spec/*` and the two concurrency docs agree with the code on If-Match behaviour. Where a route comment disagrees with the code, the code was followed.

## Critical

| ID | Verified | Changed |
|---|---|---|
| C-01 | `DELETE /record-editors/:kind/:id` calls `leave` (`recordEditorsService.js`). It removes the caller's presence and releases the lock. | 1.18.3 renamed **Remove Record Editor Presence**. Description, parameters, response and Figures 297–298 rewritten. |
| C-02 | `/therapist/profile`, `/secretary/profile` and `/admin/users` (plus the role-record routes) read **lowercase** `firstname`/`lastname` from allow-lists. These routes have no Zod schema. | Lowercase kept, since it is what the API accepts. An explicit warning was added to 1.3.3, 1.4.3, 1.5.3, 1.5.11, 1.5.13, 1.6.3 and 1.6.5. |
| C-03 | Template text present in 5 sections. | Removed. 1.15.2, 1.16.2 and 1.20.2 now read "No sign-in required." 1.12.2 and 1.13.2 explain validation through the Google OAuth `code` and signed `state`. |
| C-04 | **Partly contradicted by the code.** The 1.6 PATCH routes (`/admin/patients/…`, `/admin/therapists/…`) require If-Match (428). The 1.5 routes under `/admin/users/patients/…` and `/admin/users/therapists/…` do **not**: `recordTarget()` doesn't match those paths, so only the optional `guardFresh` check runs. They return 409 `STALE_RECORD` but never 428. | 1.6.3 and 1.6.5–1.6.8 list 200, 400, 401, 403, 404, 409, 428. 1.5.11 and 1.5.13–1.5.16 list 200, 400, 401, 403, 404, 409, mark If-Match optional, and point to the 1.6 version. **Backend follow-up:** decide whether the `/admin/users/...` versions should require If-Match. |
| C-05 | `settingsController.js:735` sets `attachment; filename="absolutecare-handover-${YYYY-MM-DD}.md"` (UTC date). | 1.16.14 shows `absolutecare-handover-YYYY-MM-DD.md` with an example. |

## High

| ID | Verified | Changed |
|---|---|---|
| H-01 | Module 1.5 routes need the role (admin, secretary or therapist) plus `userManagement:read`. Writes add `userManagement:create`, `update` or `delete`, and role-record writes add `patients:update`. Module 1.6 routes need the same role plus `patients:read`, and writes add `patients:update`. | Every 1.5 and 1.6 Configurations line names the exact keys. The 1.6.1 module text explains both real differences: the access area, and If-Match being required versus optional. Every other staff endpoint now names its keys too. |
| H-02 | `working-days` and `working-hours` share one handler. Both verification paths share `requestVerification`. The therapist calendar routes reuse the patient handlers. | 1.5.16 and 1.6.8 relabelled **(Alias)**. 1.12.6–1.12.8 renamed *Connect a Therapist Google Calendar*, *Read Therapist Calendar Connection* and *Disconnect a Therapist Calendar*, and Figures 217–222 follow. 1.16.7 renamed *Request Superuser Verification for Credential Changes*, and 1.16.17 is *(Alias)* with an explanation. |
| H-03 | The global limit is 1,000 per 15 minutes. The auth limit is 15 per 15 minutes, shared by signup, register, forgot-password and reset-password. Login allows 15 failures per 15 minutes. **`/auth/google` and `/auth/google/complete` are not under the auth limiter**; only the global limit applies to them. | The policy moved to **1.0.5**, which states that 429 can come from any endpoint. 429 was added to 1.1.9 and 1.1.12, described as the global limit. 1.1.1 now refers to 1.0.5. |
| H-04 | Codes taken from each route's middleware chain and handler. | All tables rebuilt with no row cap:<br>• 401 on every route behind `protectRoute`<br>• 403 everywhere a role, permission or account-state check applies<br>• 404 where the handler returns it<br>• 400 for validation, malformed ids and malformed If-Match<br>• 409 and 428 where If-Match is required<br>• 409 only where If-Match is optional<br>• 413, 415, 422, 500, 502 and 503 where the code emits them<br>**Exception:** 1.9.4 (`/admin/services/:id/usage`) has no 404, because an unknown id returns `count: 0`. |
| H-05.1 | `GET /documents` returns 200 with an empty list. **Figure 236 shows 400** (invalid `type`), not 404. | 404 removed, 400 and 403 added, caption corrected. No recapture needed. |
| H-05.2 | `/settings/public` never returns 404; only the `/admin/settings/public` mirror does. **Figure 248 shows 429.** | 404 replaced by 429, the mirror behaviour is explained, caption corrected. No recapture needed. |
| H-05.3 | The calendar callback **always** returns 302 (`?calendar=error&reason=expired|disabled|denied|failed|no_refresh_token`). **Figure 210 shows a 302.** | The 403 and 400 rows were removed. 302 and 429 are documented with the reason values. The same correction was made for the Drive callback (1.13.2), whose 400 row was also wrong. |
| H-05.4 | An unknown or malformed tracking number returns **HTTP 404** `{"status":"not_found"}` (Figure 246). | 1.15.2 states 404 and never 200 with `not_found`; the contradictory text was removed. |
| H-06 | `cancelReason = req.body?.reason?.trim() \|\| "Cancelled by patient"`. | 1.2.13 says the sent `reason` is saved, with "Cancelled by patient" as the default when it is omitted or empty. |
| H-07 | Two separate handlers. `/therapist/calendar/status` returns `{connected, email}`; `…/therapist-status` returns `{connected, email, connectedAt}`. Neither route is an alias of the other. | Both documented with their real fields and cross-referenced (1.3.15 and 1.12.7). |

## Medium

| ID | Verified | Changed |
|---|---|---|
| M-01 | Module 1.1 used Heading 1. | Changed to Heading 2 with a page break, matching 1.2–1.20. |
| M-02 | Figures 25–28 each embed two **different** screenshots:<br>• Figures 25 and 27: the Headers tab with If-Match, plus the Body tab<br>• Figures 26 and 28: a 409 `STALE_RECORD` attempt, plus a 428 attempt<br>None are accidental duplicates. | All 8 images kept. Captions marked "(Parts a and b)", and the explanation describes each part. |
| M-03 | The stored patient role is `user`. | 1.0.3 defines it. 1.17 uses "patient", and query enums keep `user` with a note. 1.14.6 and 1.14.7 now say "Signed-in admin…". |
| M-04 | • `/auth/google/complete` reads `terms`.<br>• `reset-password` reads only `token` and `password`; `confirmPassword` isn't read.<br>• `change-password` reads `password` and `confirmPassword`; no current password is needed.<br>• Dependent PATCH uses `firstName`, `lastName`, `dateOfBirth`, `relationship`, `sex`, `medicalNotes`.<br>• Session PATCH uses `patientVisibleNotes` and `clinicalNotes`. | All five documented exactly. 1.1.12 explicitly notes `terms` versus `acceptedTerms`. |
| M-05 | Enums and keys checked in the schemas and controllers. | Parameters were rewritten with `Path:`, `Query:`, `Header:` and `Body:` labels, exact keys, `YYYY-MM-DD`/`HH:mm` formats and allowed values. This covers:<br>• payment methods<br>• user roles and statuses<br>• `newDate`/`newTime`<br>• report and ledger filters<br>• document `type` shapes<br>• verification actions<br>• credential groups, integration keys and settings sections<br>• editor `kind` values, `singleton`, and the `sessionId` body on DELETE<br>• backup `backup`, `confirmation` and `verificationToken`<br>• the 10 dev email template names |
| M-06 | Three pagination shapes exist in the code. Documents use `{page, pages, total}`, with no `limit`. | Each list response states its exact shape, and 1.0.7 summarises all three plus the cursor lists. 1.2.14 and 1.3.10 state their different responses. |
| M-07 | — | Added **1.0 API Overview and Global Conventions**: base URL, cookie authentication (with the single Bearer exception), roles and permissions, If-Match/428/409, rate limits, the `/admin/settings` alias, and error format. The Figure 8 testing caveat is now explicitly marked as a capture taken with a temporarily lowered limit. |
| M-08 | — | Tables sorted ascending, RFC reason phrases used, and 200 text depends on the method: GET says "The requested data was returned"; writes say "The change was saved…". |
| M-09 | `forgot-password` returns 404 `ACCOUNT_NOT_FOUND`. | All invalid captions now name the status and code shown, for example 409 `STALE_RECORD`. **Security review item:** the 404 reveals whether an account exists; backend behaviour was left unchanged. |

## Low

| ID | Changed |
|---|---|
| L-01 | Every "jSON" response line was rewritten; none remain. |
| L-02 | `nextCursor .` and `expectedDownMs .` fixed. |
| L-03 | Descriptions and captions are written in sentence case; headings keep Title Case. |
| L-04 | "Own" titles became "Patient…"; 1.3.10 became "…to Google Calendar"; articles were added throughout. |
| L-05 | JSON keys, codes, paths and header values are set in a monospace font. |
| L-06 | 1.3.2 and 1.4.2 name the therapist or secretary. Parameter labels and If-Match wording are standard: "(required)" or "(optional; checked only when sent)". The redundant sentence in 1.20.1 was removed. |
| L-07 | • Payments export (1.8.9): columns documented. **It has no attachment filename**, because the code sends no `Content-Disposition` header.<br>• Audit export (1.17.3): filename `absolutecare-audit.csv` and all 8 columns documented.<br>• 1.7.5 really uses singular `note` (assign-therapist); this is now stated next to the plural `notes` used elsewhere. |

## New issues found during the audit

- **Figure 222: resolved (2026-11-22).** The original "Invalid Request" screenshot showed **204 No Content**, which is a successful disconnect. It was replaced manually with a real capture: `POST /integrations/google-calendar/therapist-disconnect` with no session cookie, returning **401 Unauthorized** `{"message": "Unauthorized: No token found"}`. The "[Screenshot needs recapture]" tag was removed. The description now reads: "This figure illustrates the unsuccessful request: no session cookie was sent, so the server returns 401 Unauthorized with \"Unauthorized: No token found\"."
- **`reCAPTCHA` casing: resolved (2026-11-22).** The five 503 rows in 1.1.2, 1.1.3, 1.1.4, 1.1.6 and 1.1.12 read "ReCAPTCHA" after automatic sentence capitalisation. They were fixed manually; the document now has 0 "ReCAPTCHA" and 41 "reCAPTCHA".
- **Secretaries always get 403 on `GET /integrations/google-drive/status`.** `driveStatus` is stored as a boolean, but `requirePermission` reads `.read` (`settingsService.js:159`). This is documented in 1.13.4 as a known issue.
- **Route comments contradict the code.** "no header = unchecked" (`adminAppointmentRoutes.js`, `adminUserRoutes.js`) and "not timestamp-guarded" (`settingsRoutes.js`) are wrong: those routes require If-Match. The documentation follows the code.
- **`/admin` router stacking.** `/admin/appointments/:id/{complete,no-show,payment}`, `/admin/sessions`, `/admin/payments` and `/admin/reports*` also require `patients:read`, and the appointment routes also need `appointments:read`. This is reflected in 1.8.
- **No `/admin/settings/*` sections.** Those 21 mirrors are covered by the 1.0.6 alias note rather than separate sections, to keep the 152-endpoint structure.

## Verification

**Before the manual edits (2026-11-22):**
- Microsoft Word opened the file read-only with no errors or repair prompt and exported a 222-page PDF.
- In the rendered pages, these all displayed correctly: 1.0, 1.1, Figures 25–28, the 1.5 and 1.6 tables, 1.18.3, and Figures 297–298.
- The OOXML audit passed: all XML/relationship files parse; 308 images all resolve; `docPr`, paragraph and bookmark IDs are unique; all 152 tables match their 3-column grid; all styles exist; and Section 1.0 and 1.1–1.20 share the Heading 2 style.

**After the manual edits and the Figure 222 sentence fix:**
- All 13 XML/relationship files parse.
- 308 image blocks, each with a unique `docPr` ID; paragraph IDs are unique.
- 152 tables.
- Figures 1–304 are sequential.
- 0 "ReCAPTCHA" and 0 "recapture".
- Word opens the final file read-only with no errors (222 pages).
