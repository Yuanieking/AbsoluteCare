# Production environment guide

Everything in `backend/.env` right now is a **local development** value
(`localhost` URLs, a local MongoDB, default secrets). This guide lists every
variable that has to change, or be created, when AbsoluteCare goes live on a
server, and the order to do it in.

Never commit `backend/.env`. It is git-ignored; keep it that way. The template
is `backend/.env.example`.

## 1. Quick checklist

Replace these before the first production start:

- [ ] `NODE_ENV=production`
- [ ] `MONGO_URI` points at the production database
- [ ] `JWT_SECRET` is a new long random string
- [ ] `CREDENTIAL_ENCRYPTION_KEY` is set (new random string)
- [ ] `GOOGLE_CALENDAR_ENCRYPTION_KEY` is a new random string
- [ ] `FRONTEND_URL` is the public `https://` address of the web app
- [ ] `API_BASE_URL` is the public `https://` address of the API
- [ ] `CORS_ORIGINS` matches the frontend origin exactly (or is left empty)
- [ ] `ADMIN_EMAILS` lists the real owner address(es)
- [ ] `SU_EMAIL` and `SU_PASS` are set (integration changes are refused without them)
- [ ] `SEED_PASSWORD` is removed (or the seed script is never run)
- [ ] Google, reCAPTCHA, Brevo and Drive values are the production ones
- [ ] `VITE_API_URL` is set **at frontend build time**
- [ ] Callback URLs are registered in Google Cloud (section 5)

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Use a different value for each key. Do not reuse your local ones.

## 2. Backend `.env` on the server

Create the file at `backend/.env` on the server (not in git) and restrict it:

```bash
chmod 600 backend/.env
```

### Server

| Variable          | Local value now                          | Production value                                                                                                                                                                               |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`        | empty / `development`                    | `production`. Turns on `Secure` + `SameSite=None` cookies (HTTPS required) and removes the `/dev` email preview routes.                                                                        |
| `PORT`            | `8080`                                   | Whatever your reverse proxy forwards to (keep `8080` if unsure).                                                                                                                               |
| `MONGO_URI`       | `mongodb://localhost:27017/absolutecare` | Production connection string, e.g. MongoDB Atlas `mongodb+srv://user:pass@cluster/absolutecare`. Always include the database name. URL-encode special characters in the password.              |
| `JWT_SECRET`      | default / dev string                     | New long random string. Changing it later logs everyone out, and it is the last-resort key for stored credentials (see `CREDENTIAL_ENCRYPTION_KEY`).                                           |
| `FRONTEND_URL`    | `http://localhost:5173`                  | `https://app.yourclinic.com`. Used for CORS, email links, and the PDF verification QR codes. If it still says `localhost`, QR codes will not scan off your machine and the API logs a warning. |
| `API_BASE_URL`    | empty (becomes `http://localhost:8080`)  | `https://api.yourclinic.com`. All OAuth redirect URIs default to this.                                                                                                                         |
| `ASSETS_BASE_URL` | empty                                    | Optional. If set, must be public and not `localhost`; email logos are served from it. Usually set it to the same value as `API_BASE_URL`.                                                      |
| `CLINIC_ADDRESS`  | `AbsoluteCare Physical Therapy`          | The real clinic name/address shown on emails and paperwork.                                                                                                                                    |
| `CORS_ORIGINS`    | empty                                    | Leave empty to allow only `FRONTEND_URL`. If set, it **replaces** `FRONTEND_URL` for CORS, so list every origin, comma-separated, with no trailing slash.                                      |
| `ADMIN_EMAILS`    | dev addresses                            | Real Google sign-in addresses that are always active admins (comma-separated).                                                                                                                 |
| `SU_EMAIL`        | none                                     | Superuser mailbox. Receives the six-digit code required to change integration credentials or turn off Google sign-in / reCAPTCHA.                                                              |
| `SU_PASS`         | none                                     | Superuser password asked before that code is sent. Use a long random value. Without both `SU_*` values these changes are refused.                                                              |
| `SEED_PASSWORD`   | demo password                            | **Delete it from production.** It is only read by `npm run seed`, which creates demo accounts. Do not seed a live database.                                                                    |

### Secrets and encryption

| Variable                         | Notes                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CREDENTIAL_ENCRYPTION_KEY`      | Encrypts credentials saved from Settings > Integrations and the Google Drive refresh token. It is empty locally and the app then silently falls back to `GOOGLE_CALENDAR_ENCRYPTION_KEY`, then `JWT_SECRET`. Set it explicitly in production, keep it stable, and back it up. Losing or changing it makes saved credentials undecryptable (you re-enter them and reconnect Drive). |
| `GOOGLE_CALENDAR_ENCRYPTION_KEY` | At least 16 random characters. The built-in default is a public string in the source code, so it **must** be replaced. Changing it disconnects every connected calendar.                                                                                                                                                                                                           |

Set all three secrets once, before real users connect anything, and then do not
rotate them casually.

### Integrations

These can be set in the file **or** from the admin UI (Settings > Integrations,
which takes effect without restart and is stored encrypted in the database). A
value saved in the UI wins over `.env`.

| Variable                                      | Production value                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`   | OAuth client from Google Cloud. `GOOGLE_SECRET_KEY` is a legacy alias; leave it empty on new installs.                                          |
| `GOOGLE_REDIRECT_URI`                         | Leave empty (defaults to `${API_BASE_URL}/auth/google/callback`) or set it to exactly that.                                                     |
| `GOOGLE_CALENDAR_REDIRECT_URI`                | Leave empty (defaults to `${API_BASE_URL}/integrations/google-calendar/callback`).                                                              |
| `GOOGLE_DRIVE_REDIRECT_URI`                   | Leave empty (defaults to `${API_BASE_URL}/integrations/google-drive/callback`).                                                                 |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID`                 | Leave empty so the app creates "AbsoluteCare Documents". See [google-drive-setup.md](google-drive-setup.md).                                    |
| `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` | Keys for the **production domain**. Keys made for `localhost` do not work on the live site. Add the real domain in the reCAPTCHA admin console. |
| `BREVO_API_KEY`                               | A v3 API key. Use a key dedicated to production. See [brevo-email-setup.md](brevo-email-setup.md).                                              |
| `MAIL_FROM`                                   | A **verified Brevo sender**, e.g. `AbsoluteCare <no-reply@yourclinic.com>`. The local default `no-reply@absolutecare.local` cannot send.        |
| `TEST_EMAIL_RECIPIENT`                        | Optional. Leave blank to send the Settings test email to the signed-in admin.                                                                   |

### Runtime behaviour

| Variable                 | Production value                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INTEGRATION_VALIDATION` | `on` (default). Only set `off` in local development.                                                                                                                                             |
| `ENV_WRITE`              | `on` lets the app rewrite `backend/.env` when credentials are saved in the UI. Use `off` if the file should be read-only (containers, config management); the database then stays authoritative. |
| `ALLOW_SELF_RESTART`     | `true` only when the process runs under pm2, systemd, Docker or Kubernetes, so the UI "restart" button works. Otherwise keep `false` and restart by hand.                                        |

Running several instances (pm2 cluster, multiple containers): only one should
rewrite `.env`. pm2 handles this through `NODE_APP_INSTANCE`; elsewhere set
`APP_PRIMARY=1` on one instance and `APP_PRIMARY=0` on the rest.

### Example production file (placeholders only)

```env
NODE_ENV=production
PORT=8080
MONGO_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/absolutecare
JWT_SECRET=<random>
CREDENTIAL_ENCRYPTION_KEY=<random>
GOOGLE_CALENDAR_ENCRYPTION_KEY=<random>

FRONTEND_URL=https://app.yourclinic.com
API_BASE_URL=https://api.yourclinic.com
ASSETS_BASE_URL=https://api.yourclinic.com
CLINIC_ADDRESS=Your Clinic Name, Street, City
ADMIN_EMAILS=owner@yourclinic.com

GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-<secret>
RECAPTCHA_SITE_KEY=<site key>
RECAPTCHA_SECRET_KEY=<secret key>

BREVO_API_KEY=<v3 key>
MAIL_FROM=AbsoluteCare <no-reply@yourclinic.com>

INTEGRATION_VALIDATION=on
ENV_WRITE=on
ALLOW_SELF_RESTART=true
```

## 3. Frontend

The frontend has one variable, `VITE_API_URL`. Vite **bakes it into the bundle
at build time**, so it is not read from the server at runtime.

```bash
cd frontend
VITE_API_URL=https://api.yourclinic.com npm run build
```

On Windows PowerShell: `$env:VITE_API_URL="https://api.yourclinic.com"; npm run build`.

Or put it in `frontend/.env.production` (not `.env.local`, which is only for
development). If you forget it, the production site calls
`http://localhost:8080` and nothing loads. Changing the API address means
rebuilding and redeploying `dist/`.

`VITE_API_URL` is public, so it is fine in a CI variable. Never put secrets in
any `VITE_` variable.

## 4. Cookies and HTTPS

With `NODE_ENV=production` the login cookie is `Secure; SameSite=None`:

- Both the frontend and the API must be served over **HTTPS**, or login will
  silently fail.
- `FRONTEND_URL` (or `CORS_ORIGINS`) must match the browser origin exactly:
  scheme, host and port, no trailing slash.
- Behind a reverse proxy (nginx, Caddy, a load balancer), forward the original
  `Host` and terminate TLS there.

## 5. Update the third-party consoles

The `.env` change alone is not enough. Each provider needs the production URLs:

1. **Google Cloud > Credentials > your OAuth client > Authorized redirect URIs.**
   Add all three, matching the env values character for character:
   - `https://api.yourclinic.com/auth/google/callback`
   - `https://api.yourclinic.com/integrations/google-calendar/callback`
   - `https://api.yourclinic.com/integrations/google-drive/callback`

   Add `https://app.yourclinic.com` under authorized JavaScript origins if
   Google sign-in runs in the browser.

2. **Google Auth platform > Audience.** Publish the app to **In production**.
   While in Testing, refresh tokens expire after 7 days. See
   [google-drive-setup.md](google-drive-setup.md).
3. **reCAPTCHA admin.** Add the production domain to the key.
4. **Brevo.** Verify the sender used in `MAIL_FROM`, and make sure the API key
   is allowed from your server (check IP restrictions in Brevo security
   settings).
5. **MongoDB Atlas (if used).** Allow the server's IP in Network Access.

## 6. Deploy and verify

```bash
cd backend
npm ci
npm run typecheck && npm run build
NODE_ENV=production npm start        # runs dist/src/app.js
```

Run it under pm2/systemd/Docker so it restarts on crashes. Then:

1. Startup logs show `Server Running on port ...` and no
   `Database initialization failed` line.
2. No warning `documents: FRONTEND_URL is not public` (it means `FRONTEND_URL`
   still contains localhost).
3. No `Integration ... is enabled in settings but not configured` warning.
4. Sign in as an admin, open **Settings > Integrations**, and use **Send test
   email**. Connect Google Drive and use **Send test file**.
5. Generate a PDF and scan its QR code from a phone. It should open the live
   `/verify/<number>` page.

## 7. Updating `.env` later

- Edit the file (or use Settings > Integrations), then **restart the API**.
  Values read at startup (`PORT`, `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`,
  `CORS_ORIGINS`, the encryption keys) only change on restart. Integration
  credentials saved in the UI apply within about 30 seconds.
- Saving credentials in the UI rewrites the managed keys in `backend/.env` and
  keeps a copy in `backend/.env.bak`. Both are git-ignored. Do not delete
  unmanaged lines; they are preserved under `# --- Unmanaged ---`.
- Take a copy of `.env` (in a password manager or secrets store) before any
  server migration. It is the only place the encryption keys live.
- Rotating `JWT_SECRET` logs everyone out. Rotating `CREDENTIAL_ENCRYPTION_KEY`
  or `GOOGLE_CALENDAR_ENCRYPTION_KEY` forces credentials to be re-entered and
  Calendar/Drive to be reconnected.

## 8. Variables you do not set

These are read from the host and should be left alone: `pm_id`,
`NODE_APP_INSTANCE`, `NOTIFY_SOCKET`, `CONTAINER`, `KUBERNETES_SERVICE_HOST`.
They only tell the app which supervisor is running it.
