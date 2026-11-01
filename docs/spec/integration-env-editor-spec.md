# Admin Integration Credential Editor — Spec

Short name: `integration-env-editor`
Status: Draft, awaiting implementation
Scope: `backend/` + `frontend/` (cross-boundary contract, both sides change)

---

## 1. Request (as given)

> how can we integrate in the admin integration settings page.. can change the variables in the .env, can update the integration (purpose is that when the ownership of this app transfer to another owner.. it is easy for them to integrate the integration feature (include edge cases in production)).. and add also feature to only show the first 5 digits of the variable for example and hide or hash ui the other key feature... (load apple-design for the ui)

Interpreted goal: an admin can open **Settings → Integrations**, see every integration credential the app needs, rotate those credentials from the browser without SSH or editing files by hand, and hand the app to a new owner with enough in-app guidance that the new owner can complete the integration setup themselves. Secrets are never shown in full; only the first five characters plus a fixed-length mask are displayed. Production failure modes (read-only filesystems, restart requirements, OTP-email deadlock, key rotation breaking connected accounts) are handled explicitly.

---

## 2. Interview decisions

These were chosen by the requester and are binding for this work.

| #   | Question                                     | Decision                                                                                                                                                                        |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Where do saved credentials live?             | **Encrypted in MongoDB _and_ best-effort rewrite of `backend/.env`** for local parity. DB is authoritative when present.                                                        |
| 2   | How does the running server pick changes up? | **Restart with confirmation.** Hot-reload is allowed to be preferred internally, but the admin must confirm the brief disruption before it happens.                             |
| 3   | Which variables are editable?                | **Integration keys only** (Google OAuth, reCAPTCHA, Google Calendar, Email). `MONGO_URI`, `JWT_SECRET`, `PORT`, `FRONTEND_URL` etc. are not editable here.                      |
| 4   | Production hosting                           | **VPS / writable disk** with a process supervisor. Read-only/serverless deployments must still degrade gracefully.                                                              |
| 5   | Mask style                                   | **First 5 characters + exactly 8 dots**: `AIzaS••••••••`. Dot count never reflects real length.                                                                                 |
| 6   | Reveal full value?                           | **Never.** Secrets never leave the server; the admin can only rotate (replace) them.                                                                                            |
| 7   | Save guard                                   | **Email OTP**, reusing the existing `settings-verification` flow.                                                                                                               |
| 8   | API payload                                  | **Write-only fields.** Blank = unchanged, typed value = replace. Responses carry masks only.                                                                                    |
| 9   | Email OTP deadlock (mail is broken)          | **Bootstrap exception**: allow the save without OTP when the mailer cannot deliver, mark it loudly and permanently as an unverified bootstrap change in the audit log.          |
| 10  | Precedence                                   | **Database wins.** `.env` / `process.env` is the fallback when the DB has no stored value for that key.                                                                         |
| 11  | Invalid credential handling                  | **Test before commit.** A real provider check runs before anything is persisted; a failed check refuses the save (422).                                                         |
| 12  | Load-bearing key changes                     | **Warn + confirm.** Changing Google client credentials or the calendar encryption key warns that N connected Google accounts must reconnect and requires explicit confirmation. |
| 13  | Editor surface                               | **Modal dialog** over a dimmed scrim, all keys of one integration in one form.                                                                                                  |
| 14  | Handover support                             | **Both**: complete the dangling `#integration-setup-guide` on-page guide _and_ a downloadable masked handover pack.                                                             |
| 15  | Restart mechanism                            | **App triggers restart** under a supervisor (pm2 / systemd / Docker restart policy), then polls until the API is back.                                                          |
| 16  | Permissions                                  | **Admin role only** (existing `requireRole("admin")`).                                                                                                                          |
| 17  | Audit detail                                 | **Masked old → new** (`AIzaS•••••••• → Zx9Qm••••••••`). Never plaintext.                                                                                                        |
| 18  | Rollback depth                               | **Last value only**, encrypted, used by the failed-change rollback path. No history UI.                                                                                         |
| 19  | `.env` rewrite strategy                      | **Rewrite whole file** from the current resolved key set.                                                                                                                       |
| 20  | Unmanaged keys                               | **Read-only list** — a collapsed "Managed outside this page" section showing key names and a `set in .env` badge, never values.                                                 |

Two decisions interact and the implementation must reconcile them: **#19 (rewrite whole file)** can destroy hand-written comments and unmanaged keys, while **#20** promises those keys still exist. Resolution: the rewrite parses the existing file first and merges unknown keys back in, then writes a canonical file (§11). Comments are regenerated, keys and values of unmanaged variables are preserved.

---

## 3. Current system findings (why this is a real change, not a UI tweak)

| Location                                              | Current behaviour                                                                                                                                       | Consequence for this feature                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/config/env.js`                           | `dotenv.config()` then `export const X = getEnv(...)` for every key                                                                                     | Values are **frozen into module constants at import time**. Writing `.env` or `process.env` later changes nothing until the process restarts.     |
| `backend/src/config/integrations.js`                  | Reads `process.env` inside `integrationValues()` on every call, but mixes in frozen constants (`GOOGLE_CLIENT_ID`, `SMTP_USER`, `MAIL_FROM`, `GMAIL_*`) | Status can report stale values for some keys and fresh ones for others. Must be re-pointed at the new resolver.                                   |
| `backend/src/services/mailer.js`                      | `const config = mailConfig(); const transport = createMailTransport(config)` at module load                                                             | A new SMTP password cannot take effect without a rebuild of the transport.                                                                        |
| `backend/src/services/calendarService.js`             | Builds `encryptionKey` from `GOOGLE_CALENDAR_ENCRYPTION_KEY` at module load; stores AES-256-GCM blobs in `googleCalendar.refreshTokenEncrypted`         | Rotating the calendar key makes every stored refresh token undecryptable. Must be gated (§10.4).                                                  |
| `backend/src/config/integrations.js`                  | `googleCalendar` requires `TOKEN_ENCRYPTION_KEY`, which **`env.js` never defines**; the app actually encrypts with `GOOGLE_CALENDAR_ENCRYPTION_KEY`     | **Existing bug**: Google Calendar always reports `configured: false`. Fix as a prerequisite, otherwise the new page shows a permanently red card. |
| `backend/src/config/integrations.js`                  | `maskClientId()` shows `••••` + **last 6** chars                                                                                                        | Replace with the interview mask (first 5 + 8 dots).                                                                                               |
| `backend/src/controller/settingsController.js`        | `GET /admin/settings/integrations`, `PATCH /:key` (`enabled` only), `POST /:key/test`, health map in-memory                                             | Extend; `PATCH /:key` must keep accepting only `enabled` / `verificationToken`.                                                                   |
| `backend/src/models/settingsAuditLogModel.js`         | `section`, `field`, `oldValue`, `newValue`, `ip`                                                                                                        | Reuse with `section: "integrationCredentials"` and masked values.                                                                                 |
| `backend/src/config/env.js` + `settingsController.js` | No `RECAPTCHA_SITE_KEY`… yes it is exported; `GMAIL_*` also exported                                                                                    | Recaptcha site key is **public** (shipped to the browser) — display it in full, mask only the secret.                                             |
| `frontend/src/pages/staff/admin/SettingsPage.jsx`     | `IntegrationCard` + `IntegrationsSection`; links to `#integration-setup-guide` at 5 call sites                                                          | **The anchor target does not exist** — clicking "View setup guide" does nothing. Build the section.                                               |
| `frontend/src/services/api/settingsApi.js`            | Thin axios wrappers                                                                                                                                     | Add credential/restart/handover calls here.                                                                                                       |
| `frontend/src/styles/index.css`                       | ~9k lines of settings + integration styles, duplicated later in the file (`.integration-card-list` appears at 8942 and 12156)                           | Add new styles near the existing integration block; do not restructure unrelated CSS.                                                             |
| Repo                                                  | No `backend/.env` committed and no `.env.example`; `.gitignore` ignores `.env`                                                                          | Create a `.env.example` template as part of the handover deliverable.                                                                             |

---

## 4. Goals / non-goals

### Goals

1. View every managed integration credential's presence, mask, source (`App` / `.env` / not set), last change, and validity from the Integrations settings section.
2. Rotate any managed credential without leaving the browser, with provider validation before commit and email-OTP authorization.
3. Apply saved values with a confirmed, app-triggered restart and verify the app came back healthy.
4. Never expose a secret: write-only fields, masked responses, masked audit entries, no values in logs.
5. Make ownership transfer self-service: setup guide per integration + masked handover pack + `.env.example`.
6. Degrade safely on production hosts: read-only filesystem, missing supervisor, multiple instances, broken mailer, invalid credentials, key rotation invalidating connected accounts.

### Non-goals

- Editing infrastructure keys (`MONGO_URI`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, `ASSETS_BASE_URL`) from the UI.
- Storing brand-new third-party integrations or a plugin system.
- Full secret history, reveal, or export of plaintext values.
- Replacing the existing settings audit log, OTP flow, or role model.
- Changing patient/therapist-facing behaviour beyond the existing `effectiveIntegrationEnabled` gating.

---

## 5. Managed key registry

A single registry (backend) is the source of truth for the API, validation, masking, and the handover export. Group ids map to the existing `integrationFields` keys plus `email`.

Legend for `kind`:

- `secret` — masked as `first5 + ••••••••`, write-only, OTP + provider test on change.
- `identifier` — masked the same way (per request), treated as sensitive-lite, OTP required, no provider test on its own (tested as part of its group).
- `public` — not a secret (shipped to clients or an address), displayed in full, still OTP-guarded on change.
- `config` — URL/host/port, displayed in full, format validation only.

### 5.1 `google` (Google sign-in, display title "Google sign-in")

| Key                    | Kind       | Required | Notes / validation                                                                                                                                                                      |
| ---------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | identifier | yes      | Must match `^\d{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$` (warn, don't hard-block, if the pattern differs).                                                                         |
| `GOOGLE_CLIENT_SECRET` | secret     | yes      | Trimmed, no whitespace inside; length 10–200; reject placeholder list.                                                                                                                  |
| `GOOGLE_SECRET_KEY`    | secret     | no       | Legacy alias read by `env.js`; shown as "legacy alias" and editable so the old owner's value can be replaced. Writing it also writes `GOOGLE_CLIENT_SECRET` (documented in the dialog). |

### 5.2 `recaptcha` (display title "reCAPTCHA")

| Key                    | Kind   | Required | Notes                                                                |
| ---------------------- | ------ | -------- | -------------------------------------------------------------------- |
| `RECAPTCHA_SITE_KEY`   | public | yes      | Displayed in full; it is already exposed via `GET /settings/public`. |
| `RECAPTCHA_SECRET_KEY` | secret | yes      | Server-side only.                                                    |

### 5.3 `googleCalendar` (display title "Google Calendar")

| Key                              | Kind   | Required | Notes                                                                                                                                                                                            |
| -------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GOOGLE_CALENDAR_REDIRECT_URI`   | config | yes      | Must be an absolute `http(s)://` URL ending in the calendar callback path; warn when host differs from the current `API_BASE_URL` host, since Google rejects unregistered redirect URIs.         |
| `GOOGLE_CALENDAR_ENCRYPTION_KEY` | secret | yes      | Changing this **invalidates every stored `refreshTokenEncrypted` value** → requires the rotate warning (§10.4). Also fixes the `TOKEN_ENCRYPTION_KEY` bug by making this the canonical key name. |

### 5.4 `email` (display title "Email provider")

Two supported paths, matching `integrations.js` and `mailer.js`:

| Key                           | Kind       | Required | Notes                                                                                                                                       |
| ----------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`                   | config     | one path | Default `smtp.gmail.com`.                                                                                                                   |
| `SMTP_PORT`                   | config     | one path | Integer 1–65535, default `465`.                                                                                                             |
| `SMTP_SECURE`                 | config     | no       | `true` / `false`; derived from port when blank.                                                                                             |
| `SMTP_USER`                   | identifier | one path | Email address.                                                                                                                              |
| `SMTP_PASS` / `SMTP_PASSWORD` | secret     | one path | `SMTP_PASS` is canonical; `SMTP_PASSWORD` remains a read alias. Writing one updates both consistently in DB; `.env` keeps only `SMTP_PASS`. |
| `MAIL_FROM`                   | public     | yes      | `Name <address>` or bare address; parsed and validated.                                                                                     |
| `GMAIL_USER`                  | identifier | optional | Gmail OAuth path; when the four `GMAIL_*` values are complete, it wins over SMTP exactly as today.                                          |
| `GMAIL_CLIENT_ID`             | identifier | optional |                                                                                                                                             |
| `GMAIL_CLIENT_SECRET`         | secret     | optional |                                                                                                                                             |
| `GMAIL_APP_PASSWORD`          | secret     | optional |                                                                                                                                             |
| `GMAIL_REFRESH_TOKEN`         | secret     | optional | Masked; no provider test (refresh tokens are exercised by the existing test email).                                                         |

Credentials shared with the Google group (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) are **read from the same stored record**. Saving them from either dialog writes the same key once; the second dialog shows "shared with Google sign-in".

### 5.5 Unmanaged keys (read-only list)

Names only, with a `set in .env` / `not set` badge, for every key present in the environment or `.env` that the registry does not manage: `MONGO_URI`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, `API_BASE_URL`, `ASSETS_BASE_URL`, `CLINIC_ADDRESS`, `SEED_PASSWORD`, `NODE_ENV`, etc. Values are never sent. A single note explains these are set on the server and are out of scope for this page.

---

## 6. Data model

### 6.1 New collection: `IntegrationCredential`

```
key           String, unique, required      // e.g. "GOOGLE_CLIENT_SECRET"
group         String, required, index       // "google" | "recaptcha" | "googleCalendar" | "email"
valueEncrypted String                       // iv:authTag:ciphertext (AES-256-GCM, hex), never logged
valueHash      String                       // sha256 hex of the plaintext, for no-op + duplicate detection only
previousEncrypted String | null             // last value, for one-step rollback
fingerprint    String                       // first 5 chars + "••••••••" cached mask hint (see 6.3)
updatedBy      ObjectId → User
clearedAt      Date | null                  // set when the admin reverts the key to .env
timestamps    true
```

- One document per key. A missing document (or `clearedAt` set) means "fall back to `.env`".
- `valueHash` is compared against a candidate hash to detect an unchanged resubmission: an identical value is a **no-op** and must not consume an OTP or write an audit entry.
- Documents are never returned directly; the controller shapes every response.

### 6.2 Encryption

Reuse the proven pattern in `backend/src/services/calendarService.js` rather than inventing one: AES-256-GCM, random 12-byte IV, `iv:tag:ciphertext` hex string.

- Extract that pair into a shared `backend/src/utils/secretBox.js` with `encryptSecret(value)` / `decryptSecret(value)` keyed by a derived app key: `sha256(CREDENTIAL_ENCRYPTION_KEY || GOOGLE_CALENDAR_ENCRYPTION_KEY || JWT_SECRET)`.
- `calendarService.js` keeps its own key derivation (its encryption is coupled to user tokens and must not silently change), but may import the generic helper for the same cipher construction.
- `decryptSecret` failures must return `null` and log only the key name — never the ciphertext or plaintext.
- Values are trimmed before encryption. Empty strings are stored as `clearedAt`, not as an encrypted empty value.

### 6.3 Masking rules (server-side only)

```
mask(value):
  trimmed = value.trim()
  if empty or placeholder           -> "Not set"
  if kind is "public" or "config"   -> full value (documented as non-secret in the UI)
  if len(trimmed) < 10              -> first 2 chars + "••••••••"
  else                              -> first 5 chars + "••••••••"
```

- Works for `kind: "secret"` and `kind: "identifier"`.
- The mask is computed **in the controller**, never in the browser, and the key's raw value is never part of any response object (guard with an explicit `toPublic()` mapper; add a regression check that no response body contains a stored plaintext).
- Placeholder detection reuses `PLACEHOLDER_VALUES` from `integrations.js` (`your-client-id`, `changeme`, `xxx`, `your-secret`, `replace-me`, `replace-with`) and treats the value as "not set".
- A short, non-reversible status line is shown next to the mask: source (`App` / `.env`), last change (admin name + date), and a `Verified` / `Unverified` / `Stale` badge (§10.5).

---

## 7. Runtime configuration resolver (the core refactor)

Freezing values at import time is the reason a saved `.env` currently does nothing without a restart. Introduce one indirection and route every integration read through it.

### 7.1 New module `backend/src/config/runtimeConfig.js`

```
getIntegrationConfig(key)          // resolved value: DB override > process.env > env.js default
getIntegrationGroup(groupId)       // resolved values for a group
hasDbOverride(key)
invalidateRuntimeConfigCache()     // called after every credential write
```

- Internally caches resolved values for 30 seconds (`Map`), cleared by `invalidateRuntimeConfigCache()`; a restart obviously clears it too.
- Reads DB overrides through a small in-memory map loaded from `IntegrationCredential` (no per-request query on the hot path), refreshed on miss or invalidation.
- Never writes resolved values into `process.env` (that would make the override indistinguishable from `.env` and break the source badges). `mailer.js` already checks `process.env` first — leave that for genuine platform env vars, and pass resolved values explicitly where the module builds a client.

### 7.2 Call sites to convert

| Module                          | Change                                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/integrations.js`        | Build `integrationValues()` from `runtimeConfig` instead of frozen constants; fix the `TOKEN_ENCRYPTION_KEY` bug by checking `GOOGLE_CALENDAR_ENCRYPTION_KEY`; apply the new mask for `details`.                           |
| `services/mailer.js`            | Replace the module-level singleton with `getMailTransport()` that rebuilds when the resolved mail config hash changes; keep a 30s reuse window. Existing `createMailTransport()` export stays (tests/verification use it). |
| `services/calendarService.js`   | Resolve client id/secret/redirect from runtime config at call time; encryption key resolution stays cached but is invalidated after a key rotation (new connections use the new key; old tokens are handled by §10.4).     |
| `controller/authController.js`  | Replace frozen `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` reads in the four OAuth handlers.                                                                                                                               |
| `services/settingsService.js`   | Keep `effectiveIntegrationEnabled` semantics; it now reflects resolved config.                                                                                                                                             |
| `middleware/verifyRecaptcha.js` | Resolve `RECAPTCHA_SECRET_KEY` per request (cheap, cached).                                                                                                                                                                |
| `emails/layout.js`              | Not integration-managed; leave on `env.js`.                                                                                                                                                                                |

---

## 8. API contract

All routes live under the existing `/admin/settings` router (already `protectRoute` + `requireRole("admin")`). All error bodies follow `{ message, code?, field?, fields? }`.

### 8.1 `GET /admin/settings/integrations/credentials`

Returns groups with keys, never values.

```json
{
  "groups": [
    {
      "id": "google",
      "title": "Google sign-in",
      "purpose": "Lets patients sign in and links therapist Google Calendars.",
      "status": {
        "configured": true,
        "missing": [],
        "verifiedAt": "2026-10-20T09:12:00.000Z",
        "stale": false
      },
      "connectedAccounts": 14,
      "keys": [
        {
          "key": "GOOGLE_CLIENT_ID",
          "kind": "identifier",
          "label": "Client ID",
          "masked": "12345••••••••",
          "source": "app",
          "required": true,
          "sharedWith": "email",
          "updatedAt": "2026-10-20T09:12:00.000Z",
          "updatedBy": { "id": "…", "name": "Jane Cruz" },
          "hasPrevious": true,
          "helpUrl": "https://console.cloud.google.com/apis/credentials"
        }
      ]
    }
  ],
  "unmanaged": [{ "key": "JWT_SECRET", "present": true }],
  "restart": { "required": false, "supported": true, "pendingSince": null },
  "mail": { "configured": true }
}
```

- `source` ∈ `app` | `env` | `none`.
- `restart.supported` is false when `ALLOW_SELF_RESTART` is unset or no supervisor is detected (`pm_id`/`NOTIFY_SOCKET`/`CONTAINER` heuristics) — UI then shows instruction-only mode.
- `connectedAccounts` counts users with a stored Google refresh token (cheap `countDocuments`) so the rotate warning can name a real number.

### 8.2 `POST /admin/settings/integrations/credentials/verification`

Request: `{ "group": "google", "values": { "GOOGLE_CLIENT_SECRET": "…" }, "confirmKeyRotation": true }`

- Rejects unknown keys, blank values, and values identical to the stored hash (`code: "NO_CHANGES"`, 400, no OTP sent).
- Runs **provider validation first** (§9). A failed validation returns `422 { code: "INVALID_CREDENTIALS", fields: { KEY: "reason" } }` before any email is sent.
- Then reuses the existing verification mechanism with a new action per group, e.g. `rotateIntegrationCredentials:google`. Extend `verificationActions` and make `requestVerification` accept the group + a `payloadDigest = sha256(group + sorted(key=value))`.
- Response: `{ message, maskedEmail, expiresAt, resendAfter, digest }` (same shape as today, plus digest).

### 8.3 `PATCH /admin/settings/integrations/credentials`

Request:

```json
{
  "group": "google",
  "values": { "GOOGLE_CLIENT_SECRET": "new-secret" },
  "verificationToken": "<jwt>",
  "digest": "<sha256>",
  "confirmKeyRotation": true
}
```

Rules:

1. Token must verify (`purpose: "settings-verification"`, same admin, correct action) **and** its embedded digest must equal the digest of the submitted values. A token issued for one value set cannot authorize another. Single use: consume on success.
2. Bootstrap exception: if `group === "email"` and the mailer cannot currently deliver (`getMailerHealth().ok !== true`) **and** the host is not production-broken, allow without a token; mark the batch `bootstrap: true`. Any other group still requires a token; a missing token returns `409 { code: "VERIFICATION_REQUIRED", bootstrapAllowed: false }`.
3. Re-run provider validation against the merged candidate config (stored values for untouched keys + submitted values). Fail → `422`, nothing written.
4. Persist: upsert each key, move the previous ciphertext to `previousEncrypted`, update `valueHash`/`fingerprint`/`updatedBy`.
5. Audit one entry per changed key (§12), masked old → new plus `bootstrap` and `ip`.
6. `invalidateRuntimeConfigCache()`, best-effort `.env` rewrite (§11), and set the restart-pending marker in `AppSetting` (`integrations.restartRequired`, `restartRequestedAt`, `restartRequestedBy`).
7. Response: `{ group, keys: [...], restartRequired: true, envWrite: "ok" | "skipped_readonly" | "failed", warnings: [...] }`.

### 8.4 `POST /admin/settings/integrations/credentials/:key/clear`

Reverts a key to `.env` (deletes the DB override, keeps `previousEncrypted`). OTP required (same action family, digest over `clear:<key>`). Audit `oldValue: masked, newValue: "reverted to .env"`. Body may carry `verificationToken` + `digest`.

### 8.5 `POST /admin/settings/integrations/credentials/:key/rollback`

Restores `previousEncrypted` (one step only). OTP required. Audit `masked previous → current`. `409` when `hasPrevious` is false.

### 8.6 `POST /admin/settings/integrations/credentials/:key/test`

Reuses/extends `POST /admin/settings/integrations/:key/test`, but for credentials groups: validates the **currently resolved** configuration without saving. Response `{ ok, message, checkedAt, fields? }`. Writes the existing `*LastTest` record so the card shows the result after reload.

### 8.7 `POST /admin/settings/integrations/restart`

- Requires no OTP (no secret is changing), but requires a valid admin session, `ALLOW_SELF_RESTART=true`, and no restart in the last 60 s (`429 RESTART_COOLDOWN`).
- Returns `202 { restartId, expectedDownMs: 20000 }`, writes an audit entry, then performs a graceful shutdown after a 250 ms delay: stop accepting connections, `server.close()`, `mongoose.connection.close()`, `process.exit(0)`.
- If self-restart is unsupported: `409 { code: "RESTART_UNSUPPORTED", command: "pm2 restart absolutecare-api" }` and the UI shows the instruction instead.
- Multi-instance safety: only the instance with `NODE_APP_INSTANCE=0` (pm2) or `APP_PRIMARY=1` may exit; others log and no-op.

### 8.8 `GET /admin/settings/integrations/handover`

Returns the Markdown handover pack as `text/markdown` with `Content-Disposition: attachment; filename="absolutecare-handover-YYYY-MM-DD.md"`. Contents per §13. Values are masked server-side; the endpoint is safe to store in a shared drive.

### 8.9 Existing endpoints — compatibility

- `GET /admin/settings/integrations` keeps its current shape and keys (`details.clientIdMasked` etc.) so `SettingsPage.jsx` keeps working during the transition; `clientIdMasked` switches to the new first-5 mask.
- `PATCH /admin/settings/integrations/:key` still accepts exactly `{ enabled, verificationToken }` and still returns `409 NOT_CONFIGURED` when enabling an unconfigured integration.

---

## 9. Provider validation (test before commit)

Validation runs server-side against a **candidate configuration**: resolved values with the submitted values merged in. All calls use `AbortSignal.timeout(8000)`, never log request bodies, and return a per-field reason string that is safe to display.

| Group            | Check                                                                                                                                                                               | Pass / fail signal                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `google`         | `POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token`, `refresh_token=invalid`, candidate `client_id`/`client_secret`                                          | `invalid_grant` → credentials themselves are accepted. `invalid_client` / `unauthorized_client` → reject with "Google rejected this client ID/secret pair." |
| `recaptcha`      | `POST https://www.google.com/recaptcha/api/siteverify` with candidate secret + a dummy token                                                                                        | `invalid-input-secret` / `missing-input-secret` → reject. Any other error code (`invalid-input-response`, `timeout-or-duplicate`) → secret accepted.        |
| `email`          | Build a transport from the candidate config (same logic as `createMailTransport`) and call `verify()` with the existing 10 s timeout                                                | `verify()` rejects → reject with the mapped message already produced by `mailer.js` (`EAUTH` → "Gmail rejected the login…").                                |
| `googleCalendar` | Reuse the `google` check when client credentials are part of the submission; otherwise syntactically validate the redirect URI and warn when its origin differs from `API_BASE_URL` | URL parse + https/http scheme; blocked on `javascript:`/relative values.                                                                                    |

Additional rules:

- A submission that touches only `config`/`public` keys (e.g. `SMTP_PORT`) still validates its group; a group with no network checkable key falls back to format validation only.
- Rate limit: max 5 validation attempts per admin per 5 minutes (`429`), to avoid using the app as an OAuth probe.
- Validation results are cached for 60 s per candidate digest so pressing Save twice does not re-hit providers.
- Offline/dev escape hatch: `INTEGRATION_VALIDATION=off` skips network checks in local development and records `validated: false` in the audit entry. Never on by default in production.

---

## 10. Operational flows

### 10.1 Happy path — rotate a Google client secret

1. Admin opens Settings → Integrations → Google sign-in → **Edit credentials**.
2. Dialog shows masked current values, source badges, help links; fields are blank with placeholder "Leave blank to keep the current value".
3. Admin pastes a new `GOOGLE_CLIENT_SECRET`, clicks **Save and verify**.
4. Client calls §8.2 → server validates → sends 6-digit code → dialog switches to the existing 6-box code entry.
5. Admin enters the code → §8.3 → response `restartRequired: true`.
6. Page shows a persistent banner: "Credentials saved. Restart to apply." with **Restart now** and **Later**.
7. Restart → app exits → supervisor brings it up → page polls liveness every 2 s up to 90 s → banner becomes "Back online — credentials applied" (auto-dismiss 6 s) and the integration card's mask updates to the new prefix.

### 10.2 Bootstrap path — mail is broken

1. Admin opens Email provider → Edit credentials, fixes `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`.
2. Validation passes (it cannot pass if the credentials are still wrong).
3. Because the mailer is not currently healthy, the server allows the save without a token and returns `warnings: ["mail_unverified_bootstrap"]`.
4. UI shows an amber note in the dialog before saving: "Email is currently failing, so we can't send a verification code. This change will be saved and marked unverified in the audit log."
5. Audit entry gets `bootstrap: true`; the credentials card shows an `Unverified` badge until a later OTP-verified change or a passing test email clears it.

### 10.3 Failed validation

- Nothing is persisted, no OTP is sent, the dialog stays open with the failing field highlighted and an inline reason.
- The provider's raw response body is never shown; only the mapped message.

### 10.4 Rotation of load-bearing keys

Changing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_CALENDAR_ENCRYPTION_KEY` triggers a pre-save confirmation step inside the dialog:

- Copy: "Changing this disconnects **N** Google Calendar connections. Their stored tokens were encrypted with the previous key and can no longer be read. Patients will need to reconnect."
- Requires the checkbox "I understand N connections must reconnect" **and** the OTP (the OTP alone is not enough because this is an irreversible data consequence).
- `confirmKeyRotation: true` is required server-side for these three keys (`409 ROTATION_CONFIRMATION_REQUIRED` otherwise).
- On commit, set `googleCalendar.refreshTokenEncrypted = ""` for affected users? **No** — do not mass-write tokens. Instead mark `googleCalendar.needsReconnect = true` on affected users (new boolean, default false) so the existing connect UI can prompt, and count them for the warning. Reconnect clears the flag.
- The audit entry records `affectedAccounts: N` and `keyRotation: true`.

### 10.5 Restart-pending state

- `AppSetting.integrations.restartRequired` (`Boolean`), `restartRequestedAt` (`Date`), `restartRequestedBy` (`ObjectId`), `restartAppliedVersion` (`Number`).
- On boot, the server compares the persisted settings `version` with `restartAppliedVersion`; if the stored credential `updatedAt` is newer than boot time, keep the banner (a crash before restart should not hide the pending work).
- The Integrations section header shows a compact chip: `Restart required` (amber) / `Up to date` (neutral, only after a successful restart or no pending change).
- Stale values: until restart, `getIntegrationStatus()` reflects the **old in-memory** values while the credential API reflects the new stored ones. The card must therefore show a `Stale` badge next to masks when `restartRequired` is true, and tooltips must say "Saved — not active until restart." This avoids the confusing case where the page claims a key is set but login still fails.

### 10.6 `.env` rewrite (see §11) outcomes

Three outcomes are surfaced, never hidden:

- `ok` — "Also written to `backend/.env`."
- `skipped_readonly` — "Stored in the app database. The server's `.env` is read-only, so it wasn't updated."
- `failed` — "Stored in the app database, but writing `.env` failed (see server logs)."

---

## 11. `.env` rewrite algorithm

Triggered after every successful credential write and clear. Best-effort: a failure never blocks the DB save.

1. Acquire an exclusive lock `backend/.env.lock` (create with `wx`); if it exists and is older than 30 s, steal it. Release in `finally`.
2. Back up: copy the current `.env` to `.env.bak-YYYYMMDD-HHmmss` (mode preserved). Keep the newest 5; never commit (`*.bak-*` added to `.gitignore`).
3. Parse the existing file with `dotenv.parse()` into a map. Preserve every key that is **not** managed by the registry (values untouched). Record parse failures and abort the rewrite (DB already saved) rather than risk destroying the file.
4. Merge: for every managed key with a DB override, use the decrypted value; for managed keys without an override, keep the existing `.env` line if present; never write a managed key whose resolved value is empty.
5. Serialize canonically:

   ```
   # AbsoluteCare environment
   # Managed by the admin integration settings page. Manual edits to the keys below
   # will be overwritten the next time credentials are saved in the app.
   # Generated 2026-10-28T09:12:00Z

   # --- Google sign-in ---
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET="..."

   # --- Email provider ---
   ...
   ```

   - Group order: `google`, `recaptcha`, `googleCalendar`, `email`, then `# --- Unmanaged ---` keys in their original order.
   - Quote values that contain whitespace, `#`, `"`, `'`, or `$`; escape `"` and `\`. Strip trailing whitespace. Reject values containing newlines (`400 INVALID_VALUE`).
   - Restrictive permissions: write the temp file with mode `0600`; if the existing file had `0644`, keep `0644` but log a warning recommending `0600`.

6. Atomic write: write `.env.tmp-<pid>`, `fs.renameSync` over `.env`. Never truncate the target first.
7. Do not write `process.env`. Do not log any value; log only `env: rewrote 7 managed keys (2 changed)`.
8. Skipped entirely when `ENV_WRITE=off` or the filesystem reports `EROFS`/`EACCES` → outcome `skipped_readonly`.
9. Multi-instance: only the primary instance rewrites. Non-primary instances skip with outcome `skipped_secondary` (treated like `ok` in the UI copy: "written by the primary instance").

---

## 12. Audit logging

Reuse `SettingsAuditLog` (no schema change required) with:

- `section: "integrationCredentials"`, `field: "<KEY>"`.
- `oldValue: mask(old)` / `newValue: mask(new)`, or `"Not set"` / `"reverted to .env"`.
- `ip` from `req.ip`.
- Extra metadata is not representable today; add two optional fields to the model, `meta: { bootstrap, keyRotation, affectedAccounts, validated, envWrite }` (`Mixed`, default `{}`), so the audit page can display badges without storing values.
- Events: rotate, clear-to-env, rollback, restart requested, restart completed (written after boot by comparing the pending marker), provider test pass/fail, reveal attempts (there are none, but a `GET` of masked data is not audited — only changes and restarts).
- The audit UI (`SettingsPage.jsx` audit section) renders `oldValue → newValue` in monospace and adds a `Bootstrap` / `Key rotation` chip from `meta`.
- Value fragments in the log stay at the 5-character level, per decision #17. Never store ciphertext in the audit log.

---

## 13. Handover deliverables

### 13.1 On-page setup guide (`#integration-setup-guide`)

A section rendered at the end of the Integrations settings section, currently linked from five places but missing. Content, one block per integration:

- What the integration powers in the app (patient Google login, bot protection, calendar sync, transactional email).
- Required keys with their exact names and which are secret vs public.
- Where to obtain each key, with external links to the Google Cloud console credentials page, the reCAPTCHA admin console, and Google account app passwords.
- The exact redirect URIs to register, built from the resolved API base URL: `<API_BASE_URL>/auth/google/callback` and `<API_BASE_URL>/integrations/google-calendar/callback`, each with a copy button.
- The current status of that integration (configured / missing keys / unverified) and a jump link to its Edit dialog.
- A short "Transfer checklist" list: rotate credentials → confirm restart → test each integration → download handover pack.

### 13.2 Downloadable handover pack (`GET /admin/settings/integrations/handover`)

Markdown, masked, safe to share. Structure:

```md
# AbsoluteCare — integration handover

Generated 2026-10-28 by <admin name>. No secret values are included in this file.

## Summary

| Integration | Status | Source |
| Google sign-in | Configured, verified 2026-10-20 | App |

## Google sign-in

Purpose: …
Keys:

- GOOGLE_CLIENT_ID — 12345•••••••• — App — updated 2026-10-20 by Jane Cruz
- GOOGLE_CLIENT_SECRET — Set — App — required
  Obtain: https://console.cloud.google.com/apis/credentials
  Register redirect URI: https://api.example.com/auth/google/callback

## Environment template

Copy `backend/.env.example` on the new server and fill these keys:
GOOGLE_CLIENT_ID=<set on new server>
…
Unmanaged keys that must also be carried over: MONGO_URI, JWT_SECRET, FRONTEND_URL, …
```

### 13.3 `backend/.env.example`

New committed template listing every supported key with an empty value, a one-line comment, and the safe defaults that `env.js` already assumes (`PORT=8080`, `SMTP_PORT=465`, …). Explicitly no real values. `README`/AGENTS note: `.env` stays ignored.

---

## 14. UI specification (Apple design)

Surface: the existing `IntegrationsSection` in `frontend/src/pages/staff/admin/SettingsPage.jsx`, which already renders four `IntegrationCard`s. Add an **Edit credentials** ghost action to each card (Google sign-in, reCAPTCHA, Google Calendar, Email provider), plus the restart banner, the setup guide, and the handover button.

### 14.1 Structure of the credential dialog

```
┌ dialog (max-width 560px, radius 20, elevation 3) ───────────────┐
│  Google sign-in credentials                              [×]    │
│  Needed so patients can sign in with Google.                    │
│                                                                 │
│  Client ID                                    App · 20 Oct      │
│  12345••••••••                                                  │
│  [ Enter a new value                                    ]       │
│  Blank keeps the current value.  Where to find this ↗           │
│                                                                 │
│  Client secret                                .env · never      │
│  Not set                                                        │
│  [ Enter a new value                                    ]       │
│  Shared with Email provider.                                    │
│                                                                 │
│  ⚠ Changing these disconnects 14 Google Calendar connections.   │
│  ☐ I understand those patients must reconnect.                  │
│                                                                 │
│  ── advanced ─────────────────────────────────────────────────  │
│  ▸ Managed outside this page (6 keys)                           │
│                                                                 │
│  [Cancel]                              [Save and verify]        │
└─────────────────────────────────────────────────────────────────┘
```

- One dialog per group; shared keys appear in both Google and Email dialogs with a "Shared with …" note and edit in place.
- Rows: label + source badge + last-changed line, masked value in a mono chip, blank input, helper line with a `↗` link to the provider console.
- **Never** a value in an input's `value`; inputs start empty, `type="password"`, `autoComplete="new-password"`, `spellCheck={false}`, paste allowed.
- Per-field inline errors (from 422 `fields`) appear under the input with `aria-invalid` and `aria-describedby`.
- Advanced disclosure holds the read-only unmanaged list and the clear/rollback actions (destructive styling, secondary placement, OTP-gated).
- Footer: `Cancel` (secondary) and `Save and verify` (primary, disabled until at least one field is dirty and all dirty fields pass local format checks). After OTP success the footer becomes `Done` + the restart banner appears behind the scrim, then the dialog closes.
- OTP step reuses the existing 6-box `VerificationDialog` markup and behaviour (same accessibility labels, same 10-minute expiry copy).

### 14.2 Materials, depth, motion

| Element          | Treatment                                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scrim            | `rgba(11, 20, 18, 0.34)` + `backdrop-filter: blur(6px)`; animate opacity 180 ms `ease-out`. Under `prefers-reduced-transparency: reduce`, drop the blur and use `rgba(11,20,18,0.55)`.                                 |
| Dialog surface   | Solid elevated surface (never translucent-on-translucent): light `#FFFFFF`, dark `#151B19`, 1px hairline `rgba(15,61,58,0.10)`, layered shadow `0 24px 60px -12px rgba(15,61,58,0.24), 0 2px 8px rgba(15,61,58,0.08)`. |
| Enter            | opacity 0→1 + scale 0.96→1 + translateY 8px→0, spring **damping 1.0, response 0.32** (no overshoot for a non-gesture surface).                                                                                         |
| Exit             | same path reversed, 180 ms; because it is reversible, use a spring re-target from the live transform (interruptible if the user reopens).                                                                              |
| Restart banner   | Spring `damping 0.9, response 0.35` slide-down 6px + fade; the amber chip inside uses a 2 px left accent, no looping pulse.                                                                                            |
| Button press     | `transform: scale(0.97)` on `pointerdown` (not click), 100 ms `ease-out`; disabled state has no press feedback.                                                                                                        |
| Test-in-progress | Spinner replaces the icon; a single 800 ms rotation loop is acceptable but must stop under `prefers-reduced-motion` (swap to static "Testing…" text).                                                                  |
| Reduced motion   | All of the above become ≤150 ms opacity cross-fades with no transform.                                                                                                                                                 |
| Focus            | Visible 2 px focus ring using the existing `--focus` token; focus trapped in the dialog; Escape closes only when not saving; focus returns to the triggering ghost action.                                             |

Mobile (`max-width: 640px`): the dialog becomes a bottom sheet (`border-radius: 20px 20px 0 0`, `max-height: 92dvh`, internal scroll with a scroll-edge fade instead of a border), entering from the bottom and exiting along the same path (damping 0.85, response 0.35 — slightly bouncier because it is dragged and flicked). Drag-to-dismiss with 1:1 tracking, 10 px hysteresis, momentum projection to the nearest snap point, and velocity handoff per the Apple guidelines. `prefers-reduced-motion` disables drag physics and uses the fade.

### 14.3 Typography and states

- Dialog title 20 px / 1.2 / weight 600 / letter-spacing −0.01em; supporting copy 14 px / 1.5; helper 13 px / 1.45; key names 12 px mono uppercase with +0.02em tracking (small text wants positive tracking).
- All spacing in `rem` so Dynamic Type/text zoom scales the layout.
- States designed explicitly: `loading` (skeleton rows, no spinner takeover), `pristine`, `dirty`, `validating`, `awaiting OTP`, `saving`, `saved-needs-restart`, `error` (field + form level), `restart polling`, `restart timed out`, `restart unsupported`.
- Copy rules: no jargon ("credentials", not "secrets management"); specific error text ("Google rejected this client ID and secret pair", never "Validation failed"); destructive copy names the outcome and the count.
- Dark mode: source badges, masked chips, and warning surfaces all get explicit dark values; never rely on opacity over a translucent background for legibility.

### 14.4 Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the title, `aria-describedby` on the purpose paragraph.
- Masked value is `aria-label`-ed, e.g. `Client ID, currently set, starts with 12345`; the dots are `aria-hidden`.
- Source badges are text, not colour-only.
- Errors announced inline via `aria-live="polite"` on the result line.
- Sheet drag never traps a keyboard user; visible close button is always reachable and the first focusable element after the title is the first input.

---

## 15. Security model

| Concern                 | Control                                                                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exposure in transit     | Secrets travel only upward, over the authenticated admin session; TLS assumed; no secrets in URLs, query strings, or analytics.                                                                                                                |
| Exposure in responses   | Explicit response shaping; mask computed server-side; no generic "return the document" path. Add a route-level assertion in development that a serialized response never contains a stored plaintext (compare against `valueHash` candidates). |
| Exposure in logs        | Never log request bodies for credential routes; add a redaction helper for Express error logs; audit stores masks only.                                                                                                                        |
| Exposure at rest        | AES-256-GCM with a key derived from an app secret; DB compromise alone is insufficient. Document that the app key lives in the environment, so backups + env together are the real blast radius.                                               |
| Unauthorized use        | `protectRoute` + `requireRole("admin")`, OTP per change bound to a value digest, single-use, 2-minute token, 3 sends per 10 minutes (existing limiter), 5 attempt lockout (existing).                                                          |
| Brute force / abuse     | Validation attempts rate-limited (5 / 5 min / admin); restart rate-limited (60 s cooldown); provider calls capped at 8 s.                                                                                                                      |
| Bootstrap window        | Explicitly flagged, audited, badged, and limited to the email group only.                                                                                                                                                                      |
| `.env` on disk          | 0600 preferred, atomic write, timestamped backups excluded from git, lock file prevents interleaved writes.                                                                                                                                    |
| Self-restart as a lever | Requires `ALLOW_SELF_RESTART=true` and admin; audited; cooldown prevents a denial-of-service loop.                                                                                                                                             |
| CSRF                    | Credential routes accept JSON only (`Content-Type: application/json`) and reuse the existing auth cookie/header behaviour; no GET-side effects.                                                                                                |
| Copy/export             | Handover export is masked; there is deliberately no plaintext export path.                                                                                                                                                                     |

---

## 16. Production edge cases (must be handled, with expected behaviour)

1. **Read-only or ephemeral filesystem** — DB save succeeds; `.env` rewrite returns `skipped_readonly`; UI states it plainly; handover pack remains the migration path.
2. **No supervisor** (started with `node src/index.js` in a terminal) — restart is unsupported; UI shows the exact command; saved values wait for a manual restart; banner persists.
3. **pm2 cluster / multiple containers** — only the primary writes `.env` and exits; siblings keep serving until the orchestrator rolls them; restart endpoint returns `202` and the UI tolerates a 2-second connection drop (polling starts after 1 s, `AbortError` treated as "still restarting").
4. **Restart crash-loop** — after 90 s of failed polling the UI shows "The server didn't come back. Check the process manager logs." plus the last health error; the pending banner stays (backed by the persisted marker).
5. **Broken mailer (bootstrap)** — allowed for the email group only, flagged unverified, and the badge persists until a verified change or a successful test email.
6. **Invalid credentials** — never persisted; provider response is mapped to a safe field-level message.
7. **Placeholder values** (`changeme`, `your-client-id`) — treated as not set everywhere (status, masks, validation), so a new owner cannot mistake a template for a working key.
8. **Stale runtime state after save** — status keeps reflecting the pre-restart values on purpose; the UI labels saved-but-inactive keys `Stale` rather than pretending they work (this is the most common "I saved it and it still fails" trap).
9. **Encryption-key rotation** — warns with a real connection count, requires an explicit checkbox + OTP, marks affected users `needsReconnect`, and never attempts to decrypt old tokens with the new key.
10. **Google client rotation while an OAuth flow is in flight** — in-flight callbacks fail with the existing `oauthError` redirect; the new client ID is in effect after restart; no half-written state because the write is a single upsert batch.
11. **Redirect-URI mismatch** — the page shows the exact URI to register and warns when the configured origin differs from `API_BASE_URL`; a wrong URI is a Google-side error the app cannot detect, so the message must be explicit.
12. **reCAPTCHA site key changed but frontend not rebuilt** — the site key is delivered at runtime via `GET /settings/public`, so a restart is enough; document this in the setup guide so the owner does not go looking for a rebuild step.
13. **Concurrent admins** — last write wins per key, but each write is audited with the admin and the value digest; if the two digests differ, the second save shows a warning that another admin changed the same key after the dialog opened (compare `updatedAt` from the form-open snapshot; `409 CONFLICT` with a "review and retry" affordance instead of silently overwriting).
14. **Clock skew / timezone** — all timestamps stored UTC; the UI formats in the clinic timezone (`Asia/Manila`) via the existing settings context.
15. **`.env` with CRLF, BOM, comments, or inline `#` comments** — parsed with `dotenv`, rewritten with LF, BOM stripped, comments regenerated for managed keys; parse failure aborts the rewrite but not the save.
16. **`.env` not present at all** — rewrite creates it (including a header), mode 0600, and logs once.
17. **Value contains spaces / quotes / `$`** — serializer quotes and escapes; newlines are rejected.
18. **Very long or short values** — max 4096 characters (reject above), mask handles short values per §6.3.
19. **Database unavailable during save** — 503 with a clear message; no OTP consumed (verify before sending the code? no — validate and persist ordering: OTP is consumed only on successful write; a failed write returns the token unused).
20. **Legacy `GOOGLE_SECRET_KEY` and `SMTP_PASSWORD` aliases** — supported as read aliases; saving writes the canonical key and shows a note that the alias stays for compatibility until the next `.env` rewrite.
21. **`TOKEN_ENCRYPTION_KEY` vs `GOOGLE_CALENDAR_ENCRYPTION_KEY`** — fix the pre-existing mismatch (§3); the new page must never report Calendar as unconfigured because of a key the app does not use.
22. **Email OTP delivery failure mid-save** — `409 MAILER_NOT_CONFIGURED` from the existing flow is surfaced with a "Use bootstrap path" hint in the dialog instead of a dead end.
23. **Admin account without an email** — existing guard already returns 400; the dialog disables Save-and-verify with an explanatory note when `mail.adminEmail === false` (add this flag to §8.1).
24. **Audit log growth** — masked entries are small; the existing pagination handles volume; no request-body storage.
25. **Rollback after a failed test email** — rollback restores the previous SMTP value but the old value may also be broken; the dialog must say "Restored the previous value. Run a test to confirm." not "Fixed".

---

## 17. Files to create / change

### Backend — new

- `src/utils/secretBox.js` — AES-256-GCM encrypt/decrypt + key derivation.
- `src/config/runtimeConfig.js` — resolver, cache, invalidation, DB override map.
- `src/config/integrationKeys.js` — the registry (§5): groups, keys, kinds, labels, help URLs, validators, mask policy.
- `src/models/integrationCredentialModel.js` — §6.1.
- `src/services/integrationCredentialService.js` — read/write/clear/rollback, digest, masking, provider validation orchestration, env write, handover rendering.
- `src/services/providerValidation.js` — Google / reCAPTCHA / SMTP checks (§9).
- `src/utils/envFile.js` — parse, merge, serialize, atomic write, backup, lock (§11).
- `src/services/restartService.js` — graceful shutdown, supervisor detection, cooldown.
- `.env.example` — §13.3.

### Backend — changed

- `src/config/integrations.js` — resolver reads, Calendar key bug, new mask, group-scoped details.
- `src/config/env.js` — keep exports for compatibility; add `CREDENTIAL_ENCRYPTION_KEY`, `ALLOW_SELF_RESTART`, `ENV_WRITE`, `INTEGRATION_VALIDATION`.
- `src/models/appSettingModel.js` — `integrations.restartRequired/restartRequestedAt/restartRequestedBy/restartAppliedVersion`.
- `src/models/settingsAuditLogModel.js` — optional `meta` Mixed field.
- `src/controller/settingsController.js` — new handlers (§8), extend `verificationActions`, rotate/clear/rollback logic, restart marker, handover.
- `src/router/settingsRoutes.js` — route wiring, JSON-only guard, download header for handover.
- `src/services/settingsService.js` — resolve through runtime config; expose restart marker in admin settings payload.
- `src/services/mailer.js` — transport built from resolved config, rebuild on config hash change.
- `src/services/calendarService.js` — resolve credentials at call time; shared cipher helper.
- `src/controller/authController.js`, `src/middleware/verifyRecaptcha.js` — resolve per call.
- `src/models/userModel.js` — `googleCalendar.needsReconnect` boolean.

### Frontend — new

- `src/components/settings/CredentialDialog.jsx` — modal (§14).
- `src/components/settings/CredentialField.jsx` — masked row + write-only input + badges.
- `src/components/settings/IntegrationSetupGuide.jsx` — §13.1.
- `src/components/settings/RestartBanner.jsx` — pending/applied/timed-out states.
- `src/utils/integrationMask.js` — display helpers only (never receives real values).

### Frontend — changed

- `src/pages/staff/admin/SettingsPage.jsx` — wire Edit credentials actions, banner, setup guide anchor, handover button, restart polling, `Unverified`/`Stale` badges.
- `src/services/api/settingsApi.js` — credential GET/POST/PATCH, verification reuse, clear/rollback, restart, handover download.
- `src/styles/index.css` — dialog, sheet, banner, badges, setup guide, dark-mode and reduced-motion variants; leave existing duplicated blocks alone.
- `frontend/README.md` — short usage/setup note per AGENTS.md guidance.

---

## 18. Acceptance criteria

1. An admin can open Settings → Integrations, see a masked value for every managed secret key in the form `first5••••••••`, and see full values only for keys marked public/config.
2. No API response, DOM node, audit entry, or log line ever contains a stored secret in full. Verified by grepping a saved session log and by a dev-mode response assertion.
3. Saving a valid new credential for any group: validates with the provider, sends an OTP, requires the code, persists encrypted, writes masked audit entries, best-effort rewrites `.env`, and sets restart-required.
4. Saving an invalid credential returns 422 with a field-level message and persists nothing.
5. With the mailer broken, saving an email credential succeeds without an OTP, is flagged `bootstrap: true` in the audit log, and shows an `Unverified` badge.
6. With `ALLOW_SELF_RESTART=false`, the restart endpoint returns 409 and the UI shows the command instead of a button.
7. With a supervisor, "Restart now" brings the API down and back, the page reconnects, and the banner resolves to "Back online".
8. Changing `GOOGLE_CALENDAR_ENCRYPTION_KEY` cannot be saved without the rotation checkbox, and affected users get `needsReconnect: true`.
9. The `#integration-setup-guide` links scroll to a real section that lists every key, where to get it, and the exact redirect URIs to register.
10. "Download handover pack" downloads a Markdown file whose contents contain no plaintext secret (assert by scanning for the known test secret).
11. `.env` rewrite preserves unmanaged keys and their values, backs up the previous file, writes atomically with restrictive permissions, and returns a distinct outcome for read-only filesystems.
12. Clearing a key removes the DB override (`source` becomes `env` or `none`) and the integration status falls back correctly; rolling back restores exactly the previous value.
13. `GET /admin/settings/integrations` still returns its old shape; existing toggles and tests still work; `npm run lint` and `npm run build` pass in `frontend/`.
14. Keyboard-only and reduced-motion paths work: dialog traps focus, Escape closes, focus returns, and motion degrades to cross-fades.
15. Google Calendar no longer reports unconfigured because of the phantom `TOKEN_ENCRYPTION_KEY` requirement.

---

## 19. Verification plan (no backend test suite exists)

Backend (`cd backend`):

1. Start with `npm run dev`; confirm startup under native ESM and that `runtimeConfig` resolves `.env` values (no DB row).
2. Obtain an admin JWT via the existing login route; script with `curl`:
   - `GET /admin/settings/integrations/credentials` → assert masks and sources.
   - `POST …/verification` with a valid secret → assert OTP email and digest returned; inspect Mongo for the pending verification.
   - `PATCH …/credentials` with a wrong digest → assert 400/409 and no DB write.
   - `PATCH` with the correct token → assert encrypted document, audit rows with masked values, `restartRequired: true`, `.env` backup created and unmanaged keys preserved.
   - Repeat with an invalid `SMTP_PASS` → assert 422 and no document.
   - Set `mailer` health to failing (temporarily blank `SMTP_PASS`) → assert bootstrap save succeeds without a token.
   - `POST …/:key/clear` and `…/rollback` → assert source and value transitions.
   - `POST …/restart` under `ALLOW_SELF_RESTART=false` → 409; with pm2 → process restarts and health returns.
3. Grep the server log for the test secret → zero matches.

Frontend (`cd frontend`): `npm run lint`, `npm run build`, then exercise the page against the running backend: open the dialog, verify masks/badges, save with OTP, see the restart banner, download the handover pack, and check mobile-width layout via device emulation (`< 640px` sheet).

Backend `npm test` remains the known-failing placeholder; report it as such, not as a pass.

---

## 20. Open questions / risks

1. **Google credential validation** relies on the `invalid_grant` vs `invalid_client` discrimination at Google's token endpoint. Confirm against a real Google project during implementation; if it proves ambiguous, fall back to format validation plus the existing post-save test.
2. **Self-restart** needs the deployment to actually restart the process. Confirm the supervisor in use (pm2? systemd? Docker `restart: unless-stopped`?) so `ALLOW_SELF_RESTART` and the displayed command are correct.
3. **Masking the Client ID** is per explicit request, though OAuth client IDs are public. Fine for handover hygiene, but the setup guide should say so, and the handover pack must still be treated as sensitive.
4. **Whole-file `.env` rewrite** loses hand-written comments by design; the merge preserves keys and values. If the owner keeps operational notes in `.env`, consider switching to a delimited managed block later.
5. **Notification to affected patients** on key rotation is out of scope here; only `needsReconnect` is set. Reconnect prompting depends on existing calendar UI.
6. **Backup/retention policy** for `.env.bak-*` files (currently last 5) may need to match the org's secret-retention rules.
7. **Whether other admins should see the `Unverified` bootstrap badge** or only the acting admin — assumed visible to all admins.
