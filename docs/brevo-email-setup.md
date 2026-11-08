# Setting up email with Brevo (free plan)

AbsoluteCare sends all of its email through **Brevo**, a hosted email service.
Brevo talks to the app over an API key, so there is no mail server, SMTP host,
or port to configure — the only things you need are a Brevo account, one
verified sender address, and an API key.

The free plan sends **300 emails a day** and needs no credit card. For a clinic
sending password resets, staff invitations and appointment notices, that is
plenty. The catch is that the daily allowance does not roll over to the next
day; unused emails are simply lost at midnight Brevo time.

Follow the steps in order. You can come back to this page whenever the key
needs rotating.

---

## 1. Create the free Brevo account

1. Open [brevo.com](https://www.brevo.com) and sign up with the clinic's email
   address.
2. Skip anything that asks for a card or a paid plan. The **free plan
   (300 emails/day)** is enough for this app.
3. Brevo may ask a few onboarding questions (company name, website, volume).
   Answer roughly; nothing here affects delivery.

> Tip: keep the account email in the same inbox as the clinic address you plan
> to send from. You will need that inbox in the next step.

---

## 2. Verify the sender address

Brevo refuses to send from an address it has not verified. The cheapest way to
prove ownership is a **single verified sender** — no DNS, SPF or DKIM records
are needed.

1. In Brevo, go to **Senders & IP → Senders**.
2. Click **Add a sender**.
3. Enter the clinic's real address (for example `owner@clinic.com`) and a
   display name like `AbsoluteCare Therapy Center`.
4. Brevo emails a verification link to that address. Open the inbox, click the
   link, and return to the Senders page — the status must read **Verified**.

A single verified sender is all this app supports. That keeps setup to one
click-through instead of a domain-wide DNS change. The trade-off: Brevo's
servers sign the message on your behalf, which is slightly less trusted by
mailbox providers than a fully authenticated clinic domain, so an occasional
message may land in a spam folder. For appointment and password-reset mail this
is a normal, acceptable trade-off. A proper domain setup can be added later
without any code change.

---

## 3. Create the API key

1. In Brevo, go to **SMTP & API → API keys**.
2. Click **Create a new API key** and name it something recognisable, such as
   `AbsoluteCare server`.
3. Confirm that the **version** column for the new key says **v3**. Any other
   version will not work with this app.
4. Copy the key immediately — **Brevo shows it only once**. Store it somewhere
   safe until you paste it into the app.

Treat this key like a password. Anyone with it can send mail as the clinic.

---

## 4. Paste the key into the app

1. Sign in to AbsoluteCare as an admin.
2. Go to **Settings → Integrations** and find the **Email provider** card.
3. Click **Edit credentials**.
4. Paste the value from step 3 into **Brevo API key**.
5. Check that **Sender address** matches the address you verified in step 2.
   It can be either `name@clinic.com` or `AbsoluteCare <name@clinic.com>`, and
   it must be exactly the verified one — a different address fails at send
   time with "Brevo won't send from this sender address yet."
6. Click **Save and verify**.

Saving does two things:

- It checks the key against Brevo's account endpoint. A mistyped or revoked key
  is rejected here with the message _"Brevo rejected this key…"_ and **nothing
  is saved** — no audit entry, no `.env` change.
- It asks for a **verification code**, because every credential change needs a
  second factor. The code is emailed to your admin address.

**If email is still broken** (for example you are setting this up for the very
first time and no mail can be sent yet), the code cannot arrive. In that case
the dialog offers a **bootstrap** option that skips the emailed code. Use it
only for this first email setup; normal changes always send the code by email.

After saving, the app may ask you to **restart** so the new key is loaded. If
the server runs under a supervisor (pm2, systemd, Docker) it can restart
itself; otherwise run the restart command shown in the dialog.

---

## 5. Prove that mail actually works

1. Return to **Settings → Integrations**.
2. On the **Email provider** card, click **Send test email**.
3. Check the inbox. Where the test lands is controlled by `TEST_EMAIL_RECIPIENT`
   in `backend/.env`: set it to a mailbox you can actually open and the test is
   delivered there; leave it blank and the test goes to the signed-in admin's
   own address. The message should arrive within a minute and the card should
   turn green (`Last test: ok`).

The save step only checks the key; the test email is the only thing that proves
the whole path, including that the sender is verified.

### What each failure message means

| Message                                                                                                                       | Meaning                                                                             | Fix                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| _Brevo rejected the API key. Copy a v3 key again from Brevo → SMTP & API → API keys._                                         | The key is wrong, expired, or revoked.                                              | Create a fresh v3 key and save it again.                                          |
| _Brevo won't send from this sender address yet. Verify it in Brevo → Senders, then try again._                                | The sender address is not verified, or `MAIL_FROM` does not match the verified one. | Verify the address in Brevo, then set `MAIL_FROM` to exactly that address.        |
| _Brevo rejected this message. Check the sender address and recipient._                                                        | Something else in the message was invalid — usually a bad recipient address.        | Check the recipient address; for internal tests use a real inbox.                 |
| _Brevo is limiting how much mail this account can send right now. Try again shortly — the free plan allows 300 emails a day._ | The 300/day cap or a burst limit was hit.                                           | Wait, or send fewer emails. There is no counter in the app; Brevo owns the quota. |
| _Brevo is temporarily unavailable. Please try again._                                                                         | Brevo returned a server error.                                                      | Retry in a few minutes.                                                           |
| _The email provider is temporarily unavailable. Please try again._                                                            | The request timed out or could not reach Brevo.                                     | Check the server's internet access, then retry.                                   |
| _Email isn't configured. Missing: `BREVO_API_KEY`._                                                                           | No usable key was found.                                                            | Save the key as described in step 4.                                              |
| _Email sending is turned off in Settings, so nothing was sent._                                                               | The admin master switch for email is off.                                           | Turn email sending back on in Settings.                                           |

The app retries a send three times (after roughly 0.25 s and 0.75 s) when the
failure looks temporary — rate limits, Brevo outages, timeouts. Bad keys and
unverified senders fail immediately, because retrying them cannot help.

---

## 6. Free-plan limits and gotchas

- **300 emails/day, no carry-over.** The cap resets daily. Transactional mail
  that overflows is queued on Brevo's side rather than by this app, so it may
  arrive late rather than not at all.
- **One verified sender.** No domain, SPF or DKIM setup is involved. See step 2
  for what that costs in deliverability.
- **No inline images.** Brevo's API cannot embed an image inside the HTML. The
  email header therefore uses a hosted logo when `ASSETS_BASE_URL` is a public
  HTTPS URL, and falls back to the text wordmark otherwise. On a local machine
  you will see the wordmark — that is expected, not a bug.
- **Free-plan branding.** Mail sent on the free plan _may_ include Brevo
  branding or footer text, depending on the account's current plan state. This
  is cosmetic and cannot be removed from the app side.
- **Revoked keys fail with 401.** Deleting a key in Brevo breaks sending until
  a new key is saved. The Integrations card turns red at that point.
- **Unverified senders fail with 400.** Changing `MAIL_FROM` to an address you
  have not verified in Brevo passes the save-time check but fails the moment a
  message is sent. Always run the test email after changing the sender.
- **Never commit the key.** It belongs in `backend/.env` (or the app's encrypted
  credential store), never in git. The app writes it to `backend/.env` for you
  when a credential is saved, unless `ENV_WRITE=off`.
