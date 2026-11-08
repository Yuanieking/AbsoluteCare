# Google Drive PDF filing — setup guide

The clinic issues PDFs from the API and files a copy into one Google Drive
account. This guide is the admin-facing part: what to configure in Google Cloud,
what to click in the app, and what each failure message means.

## 1. Google Cloud console

The Drive connection reuses the same OAuth client as Google sign-in
(`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`), so there is no second client.

1. Open **APIs & Services → Library** and enable **Google Drive API**.
2. Open **Google Auth platform → Data Access** in the left sidebar (it is not on
   the Overview page), choose **Add or remove scopes**, and tick
   `https://www.googleapis.com/auth/drive.file` plus `openid` and
   `https://www.googleapis.com/auth/userinfo.email` (the app reads the connected
   account's address from them). Press **Update**.
   - `drive.file` only appears in the table once the Drive API is enabled in
     step 1. If it is still missing, paste it into **Manually add scopes**.
   - Apps whose audience is **Internal** do not list scopes on the consent screen
     and need no Google review, so this step can be skipped for a
     Workspace-internal clinic app; the runtime request still asks for the scope.
3. Open **Google Auth platform → Audience** and publish the app to
   **In production**. While it stays in Testing, Google expires the refresh token
   after 7 days and the card asks you to reconnect every week.
   - An **Internal** audience can only be authorized by accounts inside the
     owning Workspace organisation. Signing in with an ordinary Gmail account
     stops at "Access blocked: <app> can only be used within its organization".
     Either connect an account from that organisation, or switch the audience to
     External (test users first, then publish).
4. Under **Google Auth platform → Clients → your OAuth client → Authorized
   redirect URIs**, add the exact callback address:
   `https://<api-host>/integrations/google-drive/callback`
   (for local development: `http://localhost:8080/integrations/google-drive/callback`).
   It must match `GOOGLE_DRIVE_REDIRECT_URI` character for character.

## 2. Environment

```env
GOOGLE_DRIVE_REDIRECT_URI=https://api.example.com/integrations/google-drive/callback
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

- `CREDENTIAL_ENCRYPTION_KEY` must be set before connecting. The Drive refresh
  token is encrypted at rest with it, exactly like Calendar tokens.
- Leave `GOOGLE_DRIVE_ROOT_FOLDER_ID` empty unless you have a folder this app
  created earlier. The `drive.file` scope cannot see folders the app did not
  make, so a folder id copied from My Drive fails with a permission error.

Both values can also be set in **Settings → Integrations → Google Drive → Edit
credentials**; they take effect without a restart.

## 3. Connect

1. Sign in as an administrator and open **Settings → Integrations**.
2. On the **Google Drive** card, choose **Connect Google Drive** and sign in
   with the clinic's Google account (not a personal one).
3. Consent to Drive file access. You are returned to the same settings section.
4. The card should read **Connected as clinic@example.com**.
5. Choose **Send test file**. It uploads a one-page PDF into
   `AbsoluteCare Documents/_connection-test/`, reports the file name, then
   removes it again.

The first real document creates the folder tree:

```
AbsoluteCare Documents/
  Clinic reports/2026-11/RPT-2026-000123_2026-11-07.pdf
  Patient summaries/2026-11/PTS-2026-000045_2026-11-07.pdf
  Visit records/2026-11/VIS-2026-000891_2026-11-07.pdf
  Receipts/2026-11/RCP-2026-000210_2026-11-07.pdf
```

Filenames never carry a patient name, a service or a period; only the tracking
number and the date.

## 4. Day-to-day

- **Generate PDF** appears on Reports (clinic report), patient records and
  session history (patient summary), appointments (visit record), and payments
  (receipt for a paid visit).
- **Documents** in the staff navigation lists every issued PDF with its Drive
  status, download, Drive link, verification link and a manual Retry.
- "Pending sync" means the PDF exists in the database and the upload will be
  retried by the background job (5-minute interval, five attempts with growing
  gaps). "Failed" means it needs a person: fix the cause, then choose Retry.
- The QR code on every page points at `/verify/<tracking number>` on the public
  frontend. The page answers Valid, Replaced or Revoked without a login and
  never shows patient data.

## 5. Failure messages

| Message                                                        | What to do                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Google Drive is not connected.                                 | Connect the clinic account on the card.                                                                                   |
| Google Drive access was revoked. Reconnect the clinic account. | The grant expired or was removed. Choose Reconnect. This is the usual symptom of an OAuth consent screen left in Testing. |
| The clinic Google Drive is out of storage.                     | Free space in that account or connect a different one.                                                                    |
| The app cannot write to the configured folder.                 | Clear `GOOGLE_DRIVE_ROOT_FOLDER_ID` so the app creates its own folder.                                                    |
| The configured Drive folder is not visible to this app.        | Same cause: a folder id the app never created.                                                                            |
| Google Drive is temporarily unavailable. Retrying.             | Nothing. The job retries on its own.                                                                                      |

Disconnecting stops future uploads and retries. Files already in Drive stay
there, and every existing document keeps its Drive link, download and
verification page.
