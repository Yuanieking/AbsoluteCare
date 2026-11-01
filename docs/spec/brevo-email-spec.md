# Replace SMTP Email with Brevo — Spec

Short name: `brevo-email`
Status: Draft, awaiting implementation
Scope: `backend/` + `docs/` (no frontend source changes; all UI copy is backend-driven)
Request shape: "replace the email integration from smtp to brevo, and how to integrate brevo for free"

---

## 1. Request and interpretation

> i want to replace the email integration from smtp to brevo, how to integrate brevo for free

Interpreted goal: delete the SMTP/Gmail mail path and send every transactional email
(password resets, staff invitations, appointment notifications, settings verification
codes, test email) through **Brevo's REST API v3** using a single API key, on a **free
account (300 emails/day)**, with the existing admin credential editor, health card,
env rewrite, retry and error-surfacing behaviour preserved.

The "how to integrate for free" half of the request is answered in two places:
§3 (research findings) and the new `docs/brevo-email-setup.md` guide (§11).

---

## 2. Interview decisions (binding)

| #   | Question                                | Decision                                                                                                                                                       |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Transport to Brevo                      | **REST API v3** (`POST https://api.brevo.com/v3/smtp/email`, `api-key` header). No SMTP relay, no nodemailer.                                                    |
| 2   | Fate of existing mail keys              | **Brevo only.** `SMTP_*` and `GMAIL_*` are deleted from the key registry, env, defaults and `.env.example`. No generic-SMTP alternative provider, no read aliases. |
| 3   | Sender                                  | **One verified single sender address**, e.g. the clinic's own Gmail address verified inside Brevo by link. No domain/DNS (SPF/DKIM) work in scope.             |
| 4   | Free-tier 300/day limit                 | **Documentation only.** No send counter, no quota UI, no queue. Brevo's own limit error surfaces through the existing failure path.                            |
| 5   | Inline logo (Brevo has no CID support)  | **Hosted URL only.** `ASSETS_BASE_URL` logo renders inline; otherwise the existing text wordmark + warning. The CID attachment variant is removed.              |
| 6   | Health / verify behaviour               | **Both checks.** A cheap key check (`GET /v3/account`) for boot logging + the integrations card, **and** the existing real "Send test email" button for delivery proof. |
| 7   | Retry policy                            | **Retry 429, 5xx and network/timeouts only.** `401`/`403`/`400` fail immediately. Backoff stays `250 ms` / `750 ms`, 3 attempts, 10 s timeout.                |
| 8   | Orphaned encrypted SMTP rows in Mongo   | **Delete them.** Boot-time prune of `IntegrationCredential` docs whose key is no longer in the registry.                                                        |
| 9   | Managed key set                         | **`BREVO_API_KEY` + the existing `MAIL_FROM`.** `MAIL_FROM` keeps its `Name <email>` shape and stays the sender.                                                |
| 10  | nodemailer dependency                   | **Remove entirely** (`nodemailer`, `@types/nodemailer`, and the transport code).                                                                                |
| 11  | Code structure                          | **Rewrite `services/mailer.ts` in place, same exports.** No caller changes.                                                                                    |
| 12  | Error copy                              | **Rewrite every message for Brevo** (bad key, unverified sender, rate limit, provider down).                                                                    |
| 13  | Save-time validation of the email group | **Account/key check only** — `GET /v3/account` with the candidate key. Sender verification is *not* checked at save time.                                       |
| 14  | Backoff for retryable classes           | **Keep the existing 250 ms / 750 ms** jittered backoff. Do not parse `Retry-After`.                                                                             |
| 15  | Documentation                           | **Add `docs/brevo-email-setup.md`** covering free signup → verify sender → create API key → paste into Settings → Integrations → 300/day limit.                 |
| 16  | Missing/invalid key behaviour           | **Degrade exactly like today.** `sendEmail` returns `{ sent: false, code: "NOT_CONFIGURED" }`, health card goes red, nothing else breaks, OTP bootstrap path still works. |

---

## 3. Research findings (Brevo, verified Nov 2026)

| Fact                          | Detail                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Free plan                     | **300 emails/day**, no carry-over, up to 100,000 contacts. Transactional and campaign sends share limits differently; transactional sends beyond the daily cap are held in a Brevo-side retry queue (never assume the app needs to queue). |
| API endpoint                  | `POST https://api.brevo.com/v3/smtp/email`, auth header `api-key: <key>`, JSON body.                                                                                                       |
| Key shape                     | Created at **app.brevo.com/settings/keys/api**; the version column must read **v3**.                                                                                                       |
| Required body fields          | `sender { name, email }`, `to: [{ email }]`, `subject`, plus `htmlContent` / `textContent`.                                                                                                |
| Attachments                   | Base64 `content` or a `url`, with `name`. Size-capped (≈10 MB total) — irrelevant here, the largest thing sent is the `.ics`.                                                              |
| **No inline CID images**      | Confirmed by Brevo support and third-party SDK docs: the v3 API supports no `Content-ID` inline embedding at all. This is why decision #5 exists.                                          |
| Failure shape                 | JSON `{ code, message }` with HTTP `400` (bad param / unverified sender), `401`/`403` (bad or revoked key), `429` (rate/plan), `5xx` (provider).                                          |
| Sender verification           | A single address can be verified from inside Brevo without DNS changes; sends from an unverified address fail with `400`.                                                                 |
| Free-plan branding            | Free-plan mail can carry Brevo payload/footer branding depending on plan state. Documented as a known cosmetic trade-off, not a code concern.                                             |

---

## 4. Current system inventory (what actually changes)

| File                                                       | Today                                                                                                   | Required after this change                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/services/mailer.ts`                           | `nodemailer.createTransport` over SMTP, config-hash cached transport, 10 s race, retry, `classifyMailError`, health, `passwordResetEmail` | Same exports and semantics; `fetch` to Brevo v3, key check instead of `transport.verify()`, Brevo error classification, base64 attachments.     |
| `backend/src/config/integrationKeys.ts`                    | Email group = `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `GMAIL_*`  | Email group = `BREVO_API_KEY` (secret, required) + `MAIL_FROM` (public, required); `helpUrl` → Brevo API keys page. Remove all SMTP/Gmail entries. |
| `backend/src/config/integrations.ts`                       | `email` status from `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`, with a `GMAIL_*` OAuth bypass                  | `email` status from `BREVO_API_KEY` + `MAIL_FROM`; delete the OAuth-missing branch; `sources.email` → `getIntegrationSource("BREVO_API_KEY")`.    |
| `backend/src/config/env.ts`                                | `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (465), `SMTP_USER`, `SMTP_PASSWORD`, `GMAIL_*`, `MAIL_FROM` derived from `GMAIL_USER` | `BREVO_API_KEY` (default `""`), `MAIL_FROM` with an email-less default (`AbsoluteCare Therapy Center <no-reply@absolutecare.local>`).            |
| `backend/src/config/runtimeConfig.ts`                      | `DEFAULTS` for SMTP/Gmail; `READ_CHAIN.SMTP_PASS = ["SMTP_PASS","SMTP_PASSWORD"]`                        | `BREVO_API_KEY` + `MAIL_FROM` in `DEFAULTS`; drop the SMTP read chain and every `GMAIL_*` default.                                              |
| `backend/src/services/providerValidation.ts`               | `candidateMailConfig()` builds `MailConfig` from SMTP values; `checkEmail` calls `createMailTransport().verify()` | `candidateMailConfig()` returns `{ apiKey, from, missing }`; `checkEmail` calls `GET /v3/account`; failure fields name `BREVO_API_KEY`.           |
| `backend/src/services/envWriter.ts`                        | `DROP_KEYS = {SMTP_PASSWORD}`; canonical `SMTP_PASSWORD → SMTP_PASS` migration block                      | `DROP_KEYS` becomes the retired-key set (`SMTP_*`, `GMAIL_*`) so a rewrite strips them; the migration block is deleted.                          |
| `backend/src/services/integrationCredentialService.ts`     | Special case: saving `SMTP_PASS` also writes a `SMTP_PASSWORD` alias row                                | Delete that block. Add `pruneRetiredCredentials()` and call it at boot.                                                                         |
| `backend/src/services/settingsService.ts`                  | Imports `SMTP_PASSWORD`, `SMTP_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_USER` from `env.js`                   | Remove those imports (delete any now-unused references — verify with the compiler).                                                             |
| `backend/src/controllers/settingsController.ts`            | `testEmail` → `verifyTransport()` → `sendEmail`; OTP mail; health map                                    | No code change expected; only the messages it forwards change (produced in `mailer.ts`).                                                        |
| `backend/src/app.ts`                                       | `void verifyMailer()` after `listen`                                                                     | Unchanged call; now performs a key check. Add the credential prune after `connectDB()`.                                                          |
| `backend/scripts/email-test.ts`, `scripts/email-preview.ts` | Use `sendEmail` / templates                                                                              | Unchanged (they inherit the new transport).                                                                                                     |
| `backend/package.json`                                     | `nodemailer ^7`, `@types/nodemailer ^8`                                                                  | Both removed.                                                                                                                                   |
| `backend/.env.example`                                     | SMTP/Gmail block                                                                                          | `BREVO_API_KEY` + `MAIL_FROM` only, with pointer to the new docs page.                                                                          |
| `frontend/**`                                              | **Zero** occurrences of SMTP/Gmail/mailer — every label and helper comes from the backend registry         | No source changes. Dialog fields, helpers and help links update themselves.                                                                      |

Everything else (`isEmailSendingEnabled` master switch, the OTP verification flow, the
bootstrap-without-OTP exception in `integrationCredentialController`, audit logging,
`MAIL_FROM` parsing, all email templates) stays as-is.

---

## 5. Goals / non-goals

### Goals

1. Every outgoing email goes through Brevo's v3 API with one API key.
2. The admin can rotate `BREVO_API_KEY` from Settings → Integrations exactly as today
   (mask, OTP, provider validation, audit, restart).
3. Health reporting distinguishes "no key", "key rejected", "sender not verified",
   "rate limited", "provider down", "sending switched off".
4. Email attachments (the `.ics` calendar invite) still work.
5. No nodemailer, no SMTP, no Gmail OAuth path left in the codebase or env template.
6. A new owner can go from zero to working mail using only `docs/brevo-email-setup.md`
   and the free plan.

### Non-goals

- Daily-quota accounting, drip throttling, or an app-side outbound queue.
- Domain verification / SPF / DKIM automation.
- Brevo campaigns, contacts, templates (`templateId`), or the Brevo SDK package.
- Changing email HTML/layout beyond the logo source rule.
- Any API response-shape change for the frontend.
- Multi-provider abstraction or a provider selector.

---

## 6. Managed key registry (email group after the change)

Group id stays `email` (so `emailEnabled`, `emailLastTest`, the `integrationFields`
map, and the Integrations card keep working untouched).

| Key             | Kind   | Required | Validation                                                                                     | Notes                                                                     |
| --------------- | ------ | -------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `BREVO_API_KEY` | secret | yes      | Trimmed, 8–512 chars, no whitespace/newlines, not in `PLACEHOLDER_VALUES`.                      | Masked `first5 + ••••••••`. Write-only. OTP + account check on change.    |
| `MAIL_FROM`     | public | yes      | Existing `MAIL_FROM` regex: `Name <addr>` or bare address.                                     | Displayed in full. Parsed into Brevo `sender: { name, email }` at send time. |

- Group `helpUrl` → `https://app.brevo.com/settings/keys/api` (was the Gmail app-password page).
- `BREVO_API_KEY` helper text: "Create it in Brevo → SMTP & API → API keys. The version column must say v3."
- `MAIL_FROM` helper gains: "Brevo only sends from an address you have verified as a sender."
- No `loadBearing` keys in this group → no rotation-confirmation flow.
- `INTEGRATION_GROUPS.email.purpose` reworded to stay provider-specific only where useful
  ("Sends password resets, invitations, and appointment emails through Brevo.").

Resulting status logic in `integrations.ts`:

```
email: {
  configured: BREVO_API_KEY && MAIL_FROM both non-placeholder,
  missing: [ ...missing keys ]
}
```

The old `emailOAuthMissing` / "Gmail OAuth wins over SMTP" branch is deleted, so the
email integration has exactly one path.

---

## 7. `mailer.ts` rewrite (same public interface)

Exports that **must not change shape** (5 call-site files depend on them):
`sendEmail`, `sendWithRetry`, `classifyMailError`, `createMailTransport` (see below),
`getMailTransport`, `getMailerHealth`, `verifyMailer`, `verifyTransport`,
`passwordResetEmail`, and the `MailHealth` / `SendEmailResult` / `MailConfig` types.

### 7.1 Config

```ts
interface MailConfig {
  apiKey: string;
  from: string;            // raw MAIL_FROM string
  missing: string[];       // ["BREVO_API_KEY" | "MAIL_FROM"]
}
```

`mailConfig()` reads `getIntegrationConfig("BREVO_API_KEY")` and
`getIntegrationConfig("MAIL_FROM")`, applies the existing `clean()` + `usable()`
placeholder guard, and no longer knows about hosts, ports or TLS. The
config-hash cache in `getMailTransport` is kept (same 30 s-ish reuse behaviour) and
now keys on the request descriptor instead of a nodemailer transport.

`createMailTransport(config)` is retained as a **named function that returns a send
handle or `null`** so `providerValidation.ts` and any dev tooling keep an entry point,
rather than deleting the export and breaking imports. If the implementation proves
cleaner without it, the spec permits replacing it with `sendViaBrevo(payload, config)`
**and** updating the two call sites in the same commit — but not silently dropping it.

### 7.2 Send path

```
POST https://api.brevo.com/v3/smtp/email
headers: { "api-key": <key>, "content-type": "application/json", accept: "application/json" }
{
  sender:      { name, email },        // parsed from MAIL_FROM
  to:          [ { email } ],          // string, CSV string and array all normalized
  subject,
  htmlContent: html,
  textContent: text,
  headers:     { ...caller headers },   // only when non-empty
  attachment:  [ { name, content: base64 } ]  // only when attachments exist
}
```

- Timeout: `AbortSignal.timeout(10_000)` (replaces the `Promise.race` guard; keep the
  `ETIMEDOUT` code so existing callers behave identically).
- `2xx` → `{ sent: true }`.
- Non-2xx → read the JSON body (best effort) and hand `{ status, code, message }` to
  `classifyMailError`.
- Never log the API key or the full response body; log `code` + mapped message only.

### 7.3 Attachment mapping

`EmailAttachment` in `emails/layout.ts` shrinks from a two-variant union to one:

```ts
export type EmailAttachment = { filename: string; content: string; contentType: string };
```

- The `{ filename, path, cid }` variant is deleted (it existed for the CID logo).
- The `.ics` invite already uses `content`, so only a `Buffer.from(content, "utf8").toString("base64")`
  conversion is added at the mailer boundary.
- Attachments are base64-encoded once per send; no temp files, no path reads.

### 7.4 Logo / branding change (`emails/layout.ts`)

- `hostedLogo` logic is unchanged: when `ASSETS_BASE_URL` is a public HTTPS origin the
  logo is `<img src="…/static/email/logo.png">` — Brevo renders remote images fine.
- When it is **not** public (local dev, missing variable), the CID attachment path is
  gone: `brand.logo.src = null`, `brand.logo.attachments = []`, and the layout renders
  the existing text wordmark. The current `validateEmailAssets()` warning text is
  updated to say the logo will fall back to text rather than being embedded.
- `devLogoPath` / `fs.existsSync` logo branch removed. `/static/email/logo.png`
  continues to serve the file for the hosted case.

### 7.5 Error classification (`classifyMailError`)

Input becomes `{ status?, code?, message?, name? }` instead of nodemailer's
`responseCode`/`statusCode`. All `userMessage` strings are rewritten for Brevo.

| Condition                                             | `code`                  | `retryable` | Admin-facing message                                                                                                          |
| ----------------------------------------------------- | ----------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `401` / `403`                                         | `BREVO_UNAUTHORIZED`    | no          | "Brevo rejected the API key. Copy a v3 key again from Brevo → SMTP & API → API keys."                                          |
| `400` whose message mentions sender / verified / from | `SENDER_NOT_VERIFIED`   | no          | "Brevo won't send from this sender address yet. Verify it in Brevo → Senders, then try again."                                 |
| `400` (other)                                         | `BREVO_BAD_REQUEST`     | no          | "Brevo rejected this message. Check the sender address and recipient."                                                         |
| `429`                                                 | `BREVO_RATE_LIMIT`      | **yes**     | "Brevo is limiting how much mail this account can send right now. Try again shortly — the free plan allows 300 emails a day."    |
| `5xx`                                                 | `BREVO_SERVER_ERROR`    | **yes**     | "Brevo is temporarily unavailable. Please try again."                                                                          |
| abort / `ETIMEDOUT` / `ECONNECTION` / fetch rejection | `ETIMEDOUT` / `ECONNECTION` | **yes** | "The email provider is temporarily unavailable. Please try again."                                                            |
| `NOT_CONFIGURED` (missing key/sender)                 | `NOT_CONFIGURED`        | no          | "Email isn't configured. Missing: `BREVO_API_KEY`." (existing dynamic list)                                                    |
| `EMAIL_DISABLED` (admin switch)                       | `EMAIL_DISABLED`        | no          | Unchanged: "Email sending is turned off in Settings, so nothing was sent."                                                     |

`sender` detection is a case-insensitive substring test on Brevo's `message`
(`sender`, `verified`, `from`), because Brevo does not expose a stable machine code for it.

### 7.6 Retry

Unchanged mechanics (`sendWithRetry`, `maxAttempts = 3`, delays `250 ms` / `750 ms`
plus ≤100 ms jitter). Only the retryable set changes per §7.5. No `Retry-After` parsing
(decision #14), so a 429 that outlives ~1 s surfaces to the caller/admin.

### 7.7 Health

```
health = { configured, missing[], lastCheck, ok, userMessage }
```

- `verifyMailer()` → `GET https://api.brevo.com/v3/account` with the candidate key.
  `200` → `ok: true, "Email provider is working."`; `401/403` → `ok: false` with the
  `BREVO_UNAUTHORIZED` message; network failure → retryable message. Returns `boolean`
  exactly as today (called from `app.ts` and `verifyTransport()`).
- `sendEmail()` still flips `ok: false` and records `lastCheck` on a failed send, and
  `getMailerHealth()` still feeds `GET /admin/settings/integrations/health` untouched.
- The **"Send test email"** button keeps its two-step shape: `verifyTransport()`
  (key check) → `sendEmail(renderTestEmail(...))` (real delivery proof). Because it is a
  real send, it is also the only thing that can prove the sender is verified.

---

## 8. Provider validation (`providerValidation.ts`)

- `candidateMailConfig(values)` → `{ apiKey: values.BREVO_API_KEY.trim(), from: values.MAIL_FROM.trim(), missing }`.
  Missing → 422 with `fields: { BREVO_API_KEY: "Enter a value." }` / `MAIL_FROM`.
- `checkEmail(values)` → `GET /v3/account` with `AbortSignal.timeout(8000)`:
  - `200` → pass.
  - `401`/`403` → `fields: { BREVO_API_KEY: "Brevo rejected this key. Copy a v3 API key from Brevo → SMTP & API → API keys." }`.
  - `429` → `message: "Brevo is rate limiting the check. Try again in a minute."` (do not consume the save).
  - network failure → existing generic "Couldn't reach the provider…" branch.
- `MAIL_FROM` gets the registry regex only; sender verification is **not** checked here
  (decision #13) — the test-email button is the proof.
- Candidate digest caching (60 s) and the 5-attempts-per-admin-per-5-minutes limit are unchanged.

---

## 9. Config, env writer and migration

### 9.1 `env.ts`

```ts
export const BREVO_API_KEY = getEnv("BREVO_API_KEY", "");
export const MAIL_FROM = getEnv(
  "MAIL_FROM",
  "AbsoluteCare Therapy Center <no-reply@absolutecare.local>",
);
```

Delete: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `GMAIL_USER`,
`GMAIL_APP_PASSWORD`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.
Note the `MAIL_FROM` default no longer derives itself from `GMAIL_USER`.

### 9.2 `runtimeConfig.ts`

- `DEFAULTS`: add `BREVO_API_KEY: env.BREVO_API_KEY`; keep `MAIL_FROM`; remove all
  `SMTP_*` / `GMAIL_*` entries.
- `READ_CHAIN`: remove the `SMTP_PASS → SMTP_PASSWORD` alias. Nothing else uses it.

### 9.3 `envWriter.ts`

- `DROP_KEYS` renamed to `RETIRED_KEYS` and expanded to
  `{ SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_PASSWORD, GMAIL_USER, GMAIL_APP_PASSWORD, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN }`.
- The block that copies `SMTP_PASSWORD` into `SMTP_PASS` and the "canonical migration
  counts as a change" branch are deleted.
- Retired keys are excluded from the `# --- Unmanaged ---` section, so the next
  successful credential save strips them from `backend/.env` automatically. Manual
  cleanup is not required for a working install (nothing reads them any more).

### 9.4 Orphan row prune

New `pruneRetiredCredentials()` in `integrationCredentialService.ts`:

```ts
const stale = await IntegrationCredential.find({ key: { $nin: [...MANAGED_KEYS] } }).lean();
// delete those with a non-empty retired-key list; log only the count and key names
```

- Called once from `app.ts` after `connectDB()` and after `markRestartApplied()`,
  wrapped in try/catch so a failure only logs.
- Logs `credential: pruned N retired keys` — never values. This is the moment the
  encrypted `SMTP_PASS` / `SMTP_PASSWORD` rows are destroyed (decision #8), so it must
  be the single, deliberate place that does it.
- Also covers the old `SMTP_PASSWORD` alias row and any Gmail OAuth leftovers.

---

## 10. Behaviour parity checklist (what must stay identical)

1. **Master switch**: `isEmailSendingEnabled(settings)` is still checked first in
   `sendEmail`, returning `EMAIL_DISABLED` with the same copy. Password resets and
   invitations still bypass *user* preferences but not this switch.
2. **`SendEmailResult`** union unchanged, so `authController`, `adminUserController`,
   `notificationService`, `settingsController` and the `email-test.ts` script need no edits.
3. **`passwordResetEmail({ email, token, staff })`** keeps forwarding to the template.
4. **Dashboard health payload**: `getIntegrationHealth` still spreads `getMailerHealth()`
   into the `email` entry; field names (`configured`, `missing`, `ok`, `lastCheck`,
   `userMessage`) are unchanged.
5. **Test email endpoint** `POST /admin/settings/integrations/email/test` still returns
   `502 { ok: false, message }` on failure and records `emailLastTest`.
6. **OTP/bootstrap**: `MAILER_NOT_CONFIGURED` (409) is still produced by the settings
   verification endpoint when the code email cannot be sent, and the email-group
   bootstrap save path still works when the mailer is down — which is exactly the state
   an installer is in before they add `BREVO_API_KEY`.
7. **Audit entries** still record masked old → new per key (`BREVO_API_KEY`,
   `MAIL_FROM`), same `section: "integrationCredentials"`.
8. **Restart-required marker** and the `.env` rewrite outcomes (`ok`,
   `skipped_readonly`, `skipped_secondary`, `failed`) are untouched.
9. **No response-shape changes** anywhere the frontend reads.

---

## 11. Documentation deliverable — `docs/brevo-email-setup.md`

Structure (aim: a non-technical clinic admin can follow it):

1. **What this is** — the app sends mail through Brevo; no server/SMTP knowledge needed.
2. **Create the free account** — sign up at brevo.com, free plan = **300 emails/day**,
   no card required. Note the daily cap does not roll over.
3. **Verify a sender** — Brevo → Senders & IP → add the clinic address → click the
   verification link in that inbox → status becomes verified. Explain why a single
   verified sender is used here (no DNS needed) and what the deliverability trade-off is.
4. **Create the API key** — Brevo → SMTP & API → API keys → create → confirm the
   **version column says v3** → copy it once (Brevo shows it once).
5. **Paste it into the app** — Settings → Integrations → Email provider → Edit
   credentials → `BREVO_API_KEY`, confirm `MAIL_FROM` matches the verified sender →
   Save and verify (OTP arrives by email; use the bootstrap path if mail is still dead)
   → restart when prompted.
6. **Prove it** — "Send test email" on the card; expected result and what each failure
   message means (from the §7.5 table).
7. **Free-plan limits & gotchas** — 300/day, Brevo-side retry queue for transactional
   overflow, no inline images (logo must be a public HTTPS URL), free-plan branding,
   revoked keys fail with 401, unverified senders fail with 400.

Also updated:
- `backend/.env.example` — email block becomes `BREVO_API_KEY` / `MAIL_FROM` with a
  comment linking to the new guide and a warning never to commit the key.
- `AGENTS.md` is **not** changed (it says nothing about mail).
- Historical docs (`docs/spec/integration-env-editor-spec.md`, `docs/audits/*`) are left
  as written; they describe the SMTP era. Optionally add a one-line "superseded by
  brevo-email-spec.md" header to the email section of the env-editor spec.

---

## 12. Verification plan (backend has no test suite)

Run from `backend/`:

1. `npm run typecheck` — must be clean (catches leftover `SMTP_*`/`GMAIL_*` imports and
   the removed `@types/nodemailer`).
2. `npm run build` — compiles to `dist/`.
3. `npm run dev` — boot must log either `Mailer status: ok` (key present) or
   `Mailer status: not configured (Email isn't configured. Missing: …)`, and must
   **not** throw on startup with no key at all (degraded mode, decision #16).
4. `curl http://localhost:8080/dev/emails/reset` — template renders; confirm the wordmark
   (not a broken CID image) when `ASSETS_BASE_URL` is unset, and the hosted `<img>` when set.
5. `npm run email:test -- --template=confirmed --to=<admin>` — exercises HTML + the
   `.ics` base64 attachment through Brevo; expect `{"sent":true}` and a rendered invite.
6. `POST /admin/settings/integrations/email/test` as an admin — key check + real send;
   verify `emailLastTest` gets `ok: true` and the card turns green.
7. Negative path: save a deliberately wrong `BREVO_API_KEY` through the credential
   dialog → expect `422 INVALID_CREDENTIALS` with a `BREVO_API_KEY` field error and
   **nothing written** (no audit row, no `.env` change, no OTP consumed).
8. Rate-limit/error copy: temporarily point the client at a bad base URL (or stub a 500)
   to confirm the retry path fires 3 times and then surfaces the mapped message.
9. `.env` rewrite: save a valid key, inspect `backend/.env` — `BREVO_API_KEY` and
   `MAIL_FROM` present under `# --- Email provider ---`, all `SMTP_*`/`GMAIL_*` lines gone,
   unmanaged keys preserved.
10. Prune: with a seeded `IntegrationCredential` row for `SMTP_PASS`, boot and confirm the
    row is deleted and only a count is logged.

Frontend: no build/lint change required (no source edits). Manually confirm the Email
provider dialog renders two fields with the new labels/help link and that masking still
shows `first5 + ••••••••`.

---

## 13. Edge cases and explicit answers

| Case                                                | Behaviour                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| No `BREVO_API_KEY` at all                           | `configured: false`, `missing: ["BREVO_API_KEY"]`, sends return `NOT_CONFIGURED`, app otherwise healthy.                                   |
| Key present but revoked                             | `GET /v3/account` → 401 at boot and on test; sends fail `BREVO_UNAUTHORIZED`, non-retryable, card red.                                       |
| `MAIL_FROM` not the verified sender                 | First real send → 400 → `SENDER_NOT_VERIFIED` with the verify-sender instruction. Save-time validation passes (decision #13), test email fails loudly. |
| Daily 300/day cap hit                               | Sends fail with `BREVO_RATE_LIMIT` (retryable, 3 attempts) then surface; no app-side queue, no counter. Documented in the guide.            |
| Admin turned email off                              | `EMAIL_DISABLED`, unchanged copy, nothing leaves the server.                                                                               |
| Multi-recipient / CSV `to`                          | Normalized to `to: [{ email }]` entries; invalid addresses are rejected by Brevo as `BREVO_BAD_REQUEST`.                                    |
| Attachments                                        | `.ics` only; base64, `text/calendar; charset=utf-8; method=REQUEST` preserved. Any future large attachment must respect Brevo's ~10 MB cap. |
| Inline logo on a dev machine                        | Text wordmark, no attachment, existing `validateEmailAssets()` warning reworded.                                                            |
| Email with no `text` body                           | `textContent` omitted rather than sent empty, so Brevo auto-generates a text part.                                                          |
| Very slow Brevo response                            | 10 s abort → `ETIMEDOUT`, retried twice with 250/750 ms backoff, then surfaced.                                                             |
| `.env` read-only / non-primary instance             | `.env` rewrite outcomes unchanged (`skipped_readonly` / `skipped_secondary`); DB stays authoritative.                                      |
| Old encrypted SMTP rows present                     | Pruned once at boot with a count-only log.                                                                                                 |
| Admin without an email address                      | Existing "Your account has no email address." guards in `settingsController` unchanged.                                                     |
| Free-plan branding / "sent via Brevo" hints         | Accepted trade-off; called out in the docs guide, no code workaround.                                                                       |
| Brevo key pasted with spaces / newlines             | Trimmed; newlines rejected by `validateValue` before save, same as every other secret.                                                      |

---

## 14. Open items to confirm during implementation

1. `createMailTransport` is exported and used by `providerValidation.ts` only. Keeping a
   same-name function with a Brevo shape is preferred (§7.1); confirm no other importer
   exists before changing its signature (`code_search createMailTransport`).
2. `settingsService.ts` imports four mail env constants — confirm by compiler that all
   four become unused before deleting them, and remove any that are still referenced in
   a follow-up rather than leaving dead imports.
3. Whether Brevo's `GET /v3/account` requires any extra plan/permission for a free key
   (it is documented as available to all plans; if it 403s for a plan reason, fall back
   to treating `403` as `ok: true` with a warning so a working key is never blocked).
4. Exact free-plan branding behaviour may change on Brevo's side; the guide should say
   "may include Brevo branding" rather than asserting a fixed footer.

---

## 15. Summary of files touched

```
backend/src/services/mailer.ts                     rewrite (fetch, Brevo errors, base64 attachments, key check)
backend/src/emails/layout.ts                        drop CID attachment variant + logo fallback to wordmark
backend/src/config/integrationKeys.ts               email group → BREVO_API_KEY + MAIL_FROM
backend/src/config/integrations.ts                  single-path email status, new source key
backend/src/config/env.ts                           drop SMTP_*/GMAIL_*, add BREVO_API_KEY, new MAIL_FROM default
backend/src/config/runtimeConfig.ts                 defaults + read chain
backend/src/services/providerValidation.ts          account/key check, new failure field
backend/src/services/envWriter.ts                   retired-key set, delete SMTP_PASSWORD migration
backend/src/services/integrationCredentialService.ts delete SMTP alias block, add pruneRetiredCredentials()
backend/src/services/settingsService.ts             remove stale mail imports
backend/src/app.ts                                  call pruneRetiredCredentials() after connectDB()
backend/package.json (+lock)                        remove nodemailer, @types/nodemailer
backend/.env.example                                BREVO_API_KEY + MAIL_FROM block
docs/brevo-email-setup.md                           NEW — free-plan setup guide
docs/spec/brevo-email-spec.md                       this file
```

No frontend source file changes.
