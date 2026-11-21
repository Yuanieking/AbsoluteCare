# Timestamp Concurrency Control — How It Works

This is a walkthrough of how AbsoluteCare stops two people from silently overwriting each other's edits. It covers the idea, how a request flows through the code, and the reasoning behind each decision.

---

## 1. The problem: "lost update"

```
10:00:00  Admin A opens Appointment #42   (sees status = "pending")
10:00:05  Admin B opens Appointment #42   (sees status = "pending")
10:00:10  A saves status = "confirmed"
10:00:20  B saves notes = "Call patient"  ← B's form still holds status = "pending"
```

If nothing guards the write, B's save puts back the old data and A's change is lost without anyone noticing. Concurrency control turns that silent loss into a visible conflict.

## 2. The core idea: `updatedAt` as a version number

Every Mongoose model uses `timestamps: true`, so every document has an `updatedAt` field that changes on each write. The system treats that field as a **version token**:

> "I'm editing the version stamped `2026-11-19T10:00:00.000Z`. Apply my change **only if** the record still has that stamp."

This is **optimistic concurrency control**:
- *Optimistic*: nothing is blocked up front. We assume conflicts are rare and check for one at save time.
- The check is a **compare-and-swap (CAS)**: compare the current version with the expected one, and swap in the new data only if they match. Both steps happen in **one atomic database operation**.

The token travels in the standard HTTP header made for this purpose:

```
If-Match: "2026-11-19T10:00:00.000Z"
```

On a mismatch the server returns **`409 Conflict`** with `code: "STALE_RECORD"`.

---

## 3. The complete flow

```
 FRONTEND (client.ts)                         BACKEND
 ───────────────────                          ───────
 GET /appointments/42  ───────────────────►   returns { _id: 42, updatedAt: T1, ... }
 remember 42 → T1   ◄────────────────────
 user opens editor → pin T1
 PATCH /appointments/42
   If-Match: "T1"
   X-Editor-Session: <tab uuid>  ─────────►   app.js: create a request context {target, ifMatch, editorSession}
                                              controller: guardFresh(doc, If-Match)   (Layer 1)
                                              Mongoose plugin hooks                     (Layer 2)
                                              DB: update WHERE _id=42 AND updatedAt=T1
                                                  ├─ 1 match  → saved, updatedAt = T2 → 200
                                                  └─ 0 match  → 409 STALE_RECORD
 on 409: show "record changed" banner, keep the draft
```

---

## 4. Frontend: remembering and sending timestamps

File: `frontend/src/lib/api/client.ts`

### 4.1 Remembering what the user saw (`rememberTimestamps`)
A **response interceptor** walks every API response, including nested objects and arrays up to 6 levels deep. For any object that has both `_id` and `updatedAt`, it stores `_id → updatedAt` in a `seenUpdatedAt` map.

- **Logic: keep only the newest.** `if (!previous || previous < updatedAt)`. Because ISO-8601 strings in the same format sort correctly as plain text, a string comparison is enough. This stops a slow, older GET response from replacing a newer timestamp that arrived from a write.
- Settings are stored under the key `'settings'`, and the signed-in user's id is saved as `selfId` for `/auth/profile`-style routes, which have no id in the URL.

### 4.2 Pinning the timestamp when an editor opens (`pinRecordTimestamp`)
The pin is the subtle part of the design. React Query refetches in the background, so while a user is typing, a refetch can bring in a **newer** `updatedAt` caused by **someone else's** change. If the client sent that newer value, the server would accept the save and overwrite the other person's change, which is exactly the lost update we're trying to prevent.

So when an editor mounts (`RecordEditors.tsx`), it **pins** the timestamp the form was opened with. The pin is cleared when the editor unmounts. It is stored in `editSnapshots` with a unique `Symbol` token, so several editors can pin the same record independently.

> **Rule: send the version the user's draft was based on, not the newest version the browser happens to know about.**

### 4.3 Sending the header (request interceptor)
For `PATCH / PUT / POST / DELETE`, but not `/record-editors/*`:
1. Always add `X-Editor-Session: <uuid>`, a random id created once per browser tab.
2. Work out which record the URL targets: `selfId` for own-account paths, `'settings'` for settings paths, otherwise the 24-hex ObjectId in the URL.
3. Choose the timestamp in this order: **pinned snapshot first**, then the latest seen value.
4. Set `If-Match: "<timestamp>"`, unless the caller already set one.

### 4.4 Handling a conflict
When a response is `409 STALE_RECORD`:
- dispatch a `record:stale` window event. `RecordEditors` listens for it and shows *"This record changed. Your input is preserved…"*
- invalidate queries so read-only views refresh.
- **leave the pin alone.** The draft is never silently rebased onto the new version, because that would hide the conflict. The user has to reopen the editor and review the latest data before saving.

---

## 5. Backend: three layers of protection

### Layer 0: parsing the header (`concurrencyService.js` → `parseIfMatch`)
- Trim the value, strip a weak-ETag prefix `W/`, and strip the quotes.
- Empty or `*` → `undefined`, meaning "no check requested".
- Anything that isn't a valid date → **400 ValidationError**.
- Otherwise → a `Date` object.

### Layer 1: explicit guards in controllers and services (`concurrencyService.js`)
This layer was added first. Each handler opts in by calling one of these helpers.

**A) `guardFresh(doc, ifMatch)`** for the *load → mutate → `save()`* pattern:
1. **Fail fast.** Compare `doc.updatedAt` from the loaded document with the client's timestamp. If they differ, throw `ConflictError` (409) before doing any work.
2. **Close the race window.** Between loading the document and calling `save()`, another request could write. So the function sets `doc.$where = { updatedAt: <loaded value> }`. Mongoose adds `$where` to the `save()` filter, so the database runs:
   `updateOne({ _id, updatedAt: T1 }, { ...changes })`
   This makes the save itself the atomic CAS. If nothing matches, Mongoose throws `DocumentNotFoundError`, and `middleware/errorHandler.js` converts that into **409 STALE_RECORD**.
3. **Un-pin after the first save.** `doc.$once("save", …)` deletes the pin. Some handlers save the same document twice, for example once for the edit and again for calendar sync. After the first save, `updatedAt` has changed, so a second save still pinned to T1 would be rejected by the request's own write.

**B) `freshFilter(ifMatch)`** for single-statement writes (`findOneAndUpdate`, `updateOne`, `deleteOne`):
spreads `{ updatedAt: expected }` into the query filter, so the write and the version check are one atomic operation.

**C) `assertNotStale(ifMatch, exists)`** to tell the two causes of a "no match" apart:
if the write matched nothing, either the record **doesn't exist** (→ 404) or its **version changed** (→ 409). The function checks whether the record exists, then throws 409 or lets the caller send its 404.

### Layer 2: the global Mongoose plugin (`recordConcurrency.js`)
Layer 1 only works if a developer remembers to call it, and the header is optional. Layer 2 enforces the check automatically at the model level for the record a request targets.

**Step 1: per-request context (`app.js`).**
Middleware wraps every request in `AsyncLocalStorage.run({...})`:
```
{ target: recordTarget(path, method),   // e.g. "Appointment:6650…"
  ifMatch: req.get("If-Match"),
  editorSession: req.get("X-Editor-Session") }
```
`AsyncLocalStorage` makes that object available to **any code that runs during this request**, including Mongoose hooks deep inside services, without passing `req` around. It's like a request-scoped global variable.

**Step 2: deciding which record is being edited (`recordTarget`).**
Regular expressions map URLs to `Model:id`:
- own-profile routes → `User:self`
- settings routes → `AppSetting:singleton`
- `/(admin|therapist|secretary)/(users|patients|appointments|…)/<id>` → `User:<id>`, `Appointment:<id>`, and so on
- POST requests count only for specific actions such as `cancel` or `payment`. Creating a new record is not an edit.

**Logic: scoping.** The guard applies **only** to the model and id named in the URL. Side effects on other documents, such as notifications, audit logs, or a related user, are not checked against this request's `If-Match`. Doing so would reject legitimate writes. Background jobs run outside any request context, so they skip the guard entirely.

**Step 3: `expectedFor(model, id)` decides whether to guard and which timestamp to expect.**
- No context, or a different model or id → `null` (don't guard).
- Otherwise the expected timestamp is `context.savedAt` (see step 6), or else the If-Match header, which is **required**: if it's missing, the server returns **428 PRECONDITION_REQUIRED** ("Reload this record before saving").
  → For targeted records the check is **mandatory**, unlike Layer 1, where it is optional.

**Step 4: `post("init")` remembers the loaded version.**
When a document is loaded from MongoDB, its original `updatedAt` is saved in `doc.$locals.recordTimestamp`. Mongoose's timestamp hook changes `updatedAt` before saving, so the original value has to be kept somewhere else.

**Step 5: `pre("save")` runs the CAS on document saves.**
1. Skip new documents (`isNew`).
2. Check the edit lock (Layer 3).
3. `loaded` = the value Layer 1 pinned in `$where`, if any, otherwise the remembered original. If it differs from `expected` → 409.
4. Pin `$where.updatedAt = expected` so the save is an atomic CAS.
5. **Set a strictly increasing new timestamp:**
   `updatedAt = max(Date.now(), expected + 1ms)`
   Timestamps only have millisecond precision, and server clocks can drift backwards. Without the `+1`, two writes in the same millisecond could produce the **same** version, and a stale client would pass the check. This rule ensures that every write produces a new, higher version.

**Step 6: `post("save")` chains versions within a request.**
It writes the new `updatedAt` into `context.savedAt`. If the same request saves the record again, `expectedFor` uses `savedAt` instead of the client's (now outdated) If-Match. The request's own first write doesn't count as a conflict.

**Step 7: query hooks (`findOneAndUpdate`, `updateOne`, `deleteOne`, `findOneAndDelete`).**
The same logic, applied to query-style writes:
- add `updatedAt: expected` to the filter. For `AppSetting`, the filter also requires that the caller holds a valid settings edit lease, or that no other lease is active.
- **force `upsert: false`.** This matters: with upsert enabled, a filter that fails to match because the version is stale would **create a new duplicate document** instead of failing.
- for updates, `$set.updatedAt = max(now, expected + 1)` (same rule as above), saved as `pendingTimestamp`.
- `post` hook: `null` result, `matchedCount === 0`, or `deletedCount === 0` → 409. On success, `savedAt = pendingTimestamp`.

### Layer 3: the edit lock / presence (`recordEditorsService.js`, `RecordEditors.tsx`)
Timestamps **detect** conflicts after they happen. The lock **prevents** most of them by telling the second person they can't edit yet. This is a soft, pessimistic lock on top of the optimistic check.

- **Heartbeat:** while an editor is open, the tab sends `PUT /record-editors/<kind>/<id>` every 15 seconds, or every 3 seconds while it is waiting for a lock.
- **TTL = 45 seconds:** an entry older than that counts as gone. A closed laptop or crashed tab therefore can't hold a lock forever. The `expiresAt` field lets MongoDB clean up old documents.
- **Who holds the lock (`editorHolder`):** among live entries, the one with the **earliest `joinedAt`**. Ties are broken by `sessionId`, so every server picks the same holder. Heartbeats keep the original `joinedAt`, so the first editor keeps the lock.
- **Atomic heartbeat:** one aggregation-pipeline `findOneAndUpdate` does three things at once: removes expired entries, removes this session's old entry, and appends a fresh one. Two tabs sending heartbeats at the same moment therefore can't overwrite each other's entries. If both try to create the document at once, MongoDB returns a duplicate-key error (`11000`) and the code retries once.
- **Server enforcement:** `assertNotLocked` in the plugin rejects writes from any session other than the holder's with **409 RECORD_LOCKED**. It runs once per request (`lockChecked`).
- **UI:** while the tab is locked, or before the first heartbeat reply arrives, the form's sibling elements get the `inert` attribute. They stay visible but can't be clicked or typed into. When the holder leaves, the UI says *"The other editor finished… review the latest details."*
- If the presence endpoint fails, the UI unlocks, but **the server still enforces both the lock and the timestamp check**.

---

## 6. Writes that deliberately don't change the version

Some automatic updates use `{ timestamps: false }` so they **don't change `updatedAt`**:
- `jobs/appointmentReminderJob.js`: marks reminders as sent
- `services/calendarService.js`: stores Google Calendar event IDs
- `services/settingsService.js`: stores lease bookkeeping and integration test results

**Logic:** these are system metadata, not edits a user needs to review. If they changed the version, users would get false "someone changed this record" conflicts.

---

## 7. Worked example (the scenario from section 1)

| Time | Event | DB `updatedAt` | Result |
|---|---|---|---|
| 10:00:00 | A loads #42, pins T1 | T1 | |
| 10:00:05 | B opens #42 → heartbeat says A holds the lock → B's form is inert | T1 | Layer 3 blocks |
| *(suppose B's tab bypasses the lock or the lock expired)* | | | |
| 10:00:10 | A: `PATCH If-Match: T1` → filter `{_id:42, updatedAt:T1}` matches | **T2** | 200 |
| 10:00:20 | B: `PATCH If-Match: T1` → filter `{_id:42, updatedAt:T1}` matches **nothing** | T2 | **409 STALE_RECORD** |
| | B sees the banner; the draft is kept; B reopens, gets T2, reviews, saves | T3 | 200 |

---

## 8. Status codes at a glance

| Code | `code` | Meaning |
|---|---|---|
| 400 | (validation) | `If-Match` is not a valid timestamp |
| 409 | `STALE_RECORD` | The record changed since you loaded it |
| 409 | `RECORD_LOCKED` | Another session currently holds the edit lock |
| 428 | `PRECONDITION_REQUIRED` | A targeted record write arrived without `If-Match` |

---

## 9. Known limits and caveats

- **Millisecond precision.** The `+1ms` rule ensures new versions always increase. A version counter (`__v`-style) would be stricter if this ever becomes a problem.
- **The lock check and the write aren't one atomic step.** A tiny window exists between them, but the timestamp CAS still catches any overwrite. The lock is a convenience, and the CAS is what guarantees correctness.
- **Settings are one singleton document.** Edits to different settings sections still conflict with each other.
- **Routes that `recordTarget` doesn't match** fall back to Layer 1, where the header is optional, so a client that sends no header can still overwrite.
- **`seenUpdatedAt` in the browser grows without limit** for the life of the tab. That's fine for normal use.
- **`docs/concurrency-control.md` is partly outdated.** It still lists `.ts` file paths from before the JavaScript conversion, says a missing `If-Match` always skips the check (no longer true for targeted records, which now return 428), and describes the check as "does not lock" (the edit lock was added later).

---

## 10. File map

| Concern | File |
|---|---|
| Header parsing, `guardFresh`, `freshFilter`, `assertNotStale` | `backend/src/services/concurrencyService.js` |
| Request context, `recordTarget`, global plugin, edit-lock check | `backend/src/services/recordConcurrency.js` |
| Plugin registration | `backend/src/config/audit.js` |
| Context middleware and CORS headers | `backend/src/app.js` |
| `ConflictError` (409 STALE_RECORD) | `backend/src/errors/AppError.js` |
| `DocumentNotFoundError` → 409 | `backend/src/middleware/errorHandler.js` |
| Presence and lock persistence | `backend/src/services/recordEditorsService.js` |
| Timestamp memory, pinning, headers, 409 handling | `frontend/src/lib/api/client.ts` |
| Heartbeat, lock UI, stale banner | `frontend/src/components/form/RecordEditors.tsx` |
| Tests | `backend/tests/record-concurrency.test.mjs`, `backend/scripts/concurrencyCheck.ts` |
