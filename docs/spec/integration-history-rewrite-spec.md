# Integration Branch History Rewrite — Spec

Short name: `integration-history-rewrite`
Status: Implemented locally (24 commits on `integration`). **Not pushed** — publishing is deferred until the team emails are verified (§4.2).
Scope: Git history only — `integration` branch ref. No file content changes.

---

## 1. Request (as given)

> after the plaky.md can we make the commit history in this integration branch, based on plaky.md, their username on that assigned sprint, not my username, so in commit history, they are the one who commited, and the dates its done, that what is committed

Interpreted goal: the `integration` branch should read as a real team history — the work recorded in `docs/plaky.md` split across the sprints, each sprint's commits attributed to the teammate who owned those items on the Plaky board, with author/committer dates matching the day the items were marked done. The code itself must not change: the tip of the rewritten branch must have a tree **identical** to today's `origin/integration`.

---

## 2. Interview decisions

Binding for this work.

| #   | Question                                | Decision                                                                                                                              |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | History granularity                     | **Per sprint + assignee** — ~24 commits; each sprint split into one commit per person who worked it.                                   |
| 2   | Dates for Plaky items with no date      | **Spread 25 Sep – 22 Oct 2026** (Sprint 2 has no dates on the board; Sprint 1 and 3 date ranges are respected).                        |
| 3   | Danziel Jean Lumactod's email           | **`2301112832@student.buksu.edu.ph`** (`dahnzel.j@gmail.com` is not used).                                                             |
| 4   | Destination                             | **Rewrite the local `integration` branch only. No push, no force-push.** The old tip is preserved under a backup ref (§9).             |
| 5   | Commit message style                    | **Plaky title style** — subject is the Plaky item title, body lists every item that person closed in that sprint (§7).                  |
| 6   | Committer identity                      | Author **and** committer are both set to the teammate, so dates and attribution agree in `git log`, GitHub UI, and `git shortlog`.     |
| 7   | Existing three commits                  | **Folded in.** Their content is re-sliced into the sprint commits; nothing is dropped, nothing is added.                               || 8   | Commit body footer                      | None — no AI attribution, no co-author trailer (this is a rewritten team history, not an authored commit).                             |
| 9   | GitHub account linking                  | **Option A — teammates add and verify their student emails on GitHub.** No noreply addresses are used; the commit emails stay as specified in §4. |
| 10  | Branch checked out                      | `integration` is checked out locally after the rewrite, so `git log` shows the new history by default.                                |
| 11  | Publishing                              | **Deferred.** No push until the requester says so; until then GitHub keeps showing the old 3-commit history.                          |

---

## 3. Current state (measured, not assumed)

| Fact                     | Value                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Branch under change      | local `integration` = `origin/integration` = `32f0c41`                                                      |
| Commits today            | **3**                                                                                                       |
| Commit authors today     | `Yuan Simene <yuansimene123@gmail.com>` (initial commit), `Danziel Jean Lumactod <dahnzel.j@gmail.com>` (×2) |
| Files in the tree        | **368** (247 project files + 121 `.agents/skills/**` files)                                                 |
| Code in commit 1         | 368 files, 58 872 insertions — the entire application, in one commit                                        |
| Commits 2–3              | breadcrumb removal + breadcrumb revision (7 files total)                                                    |
| `docs/plaky.md` in git?  | **No** — `docs/` is untracked, so the board never appears in history                                        |

Consequence: the whole app is one dump. "Splitting history by sprint" therefore means **re-slicing that tree** into commits that add the files each sprint's features live in. It cannot recover the true edit sequence (that information does not exist), and intermediate commits are not guaranteed to compile on their own (§11).

---

## 4. Identity map

| Teammate                   | GitHub username | Git author name         | Git author email                   | Plaky items owned (name-dated)                       |
| -------------------------- | --------------- | ----------------------- | ---------------------------------- | ---------------------------------------------------- |
| Julia Rica Soson           | `julaya-00`     | `Julia Rica Soson`      | `2401103363@student.buksu.edu.ph`  | Sprint 1–3 patient-side items, A-012, A-015, TH-005 |
| Chennie Magbanua           | `shenyyeah`     | `Chennie Magbanua`      | `2401101439@student.buksu.edu.ph`  | Sprint 1–3 therapist/secretary items, A-008/009/011, A-024 |
| Danziel Jean Lumactod      | `Danzie0`       | `Danziel Jean Lumactod` | `2301112832@student.buksu.edu.ph`  | Sprint 1–3 admin items, A-004/005/006, SE-004       |
| Carlitos Mari Simene       | `Yuanieking`    | `Carlitos Mari Simene`  | `yuansimene123@gmail.com`          | **No Plaky items** — owns the scaffold commit only   |

Notes:

- Plaky assigns **no items** to Carlitos Mari Simene. He is the repository owner (the account that created the repo and today's "initial commit"), so he keeps exactly one commit: the scaffold (§5, commit 1). This also removes the old `Yuan Simene` identity in favour of his full name.
- The local user identity (`Drakaniia <floresaybaez574@gmail.com>`) is **not used anywhere** in the new history.
- Spacing in names: the Plaky CSV has a stray tab in "Danziel Jean  Lumactod"; the GitHub name is used verbatim (`Danziel Jean Lumactod`).
- GitHub only shows a commit as belonging to an account when the commit **email is verified on that account**. The two student emails must be added to Julia's, Chennie's and Danziel's GitHub accounts, otherwise the commits show as unlinked authors with the right name.

### 4.2 Account linking — option A (chosen)

The commit emails stay exactly as listed above, so nothing in the history changes. Each teammate must, in GitHub → **Settings → Emails → Add email address**, add their address and click the verification link:

| Teammate | Email to verify | Appears as |
| -------- | --------------- | ---------- |
| Julia Rica Soson | `2401103363@student.buksu.edu.ph` | `@julaya-00` |
| Chennie Magbanua | `2401101439@student.buksu.edu.ph` | `@shenyyeah` |
| Danziel Jean Lumactod | `2301112832@student.buksu.edu.ph` | `@Danzie0` |
| Carlitos Mari Simene | `yuansimene123@gmail.com` | `@Yuanieking` (already the repo owner) |

Until an address is verified, that person's commits still show the correct **name, email and dates**, but GitHub renders them as an unlinked author: no avatar, no profile link. Verification is retroactive — once the email is confirmed, every commit already carrying it links to the account, so verification does **not** need to happen before the force-push. The reverse also holds: verification alone does nothing visible until the branch is pushed.

### 4.1 Sprints 4–9 have no assignee on the board

`plaky.md` dates every item in Sprints 4–9 as `31 Oct 2026` but names nobody. Rule used to attribute them, matching the role split the board already uses in Sprints 1–3:

| Plaky prefix | Role      | Author                |
| ------------ | --------- | --------------------- |
| `PA-*`       | Patient   | Julia Rica Soson      |
| `TH-*`       | Therapist | Chennie Magbanua      |
| `SE-*`       | Secretary | Chennie Magbanua      |
| `A-*`        | Admin     | Danziel Jean Lumactod |

A sprint is split by author, so a sprint with two roles yields two commits, three roles yields three.

---

## 5. Target history — 24 commits

All times `+0800`. Dates are the Plaky completion dates (Sprint 1: 17–19 Sep, Sprint 2 spread 25 Sep–22 Oct, Sprint 3 through 22 Oct, Sprints 4–9: 31 Oct).

| #  | Sprint | Author           | When (2026)          | Subject (first Plaky item of that person in that sprint) |
| -- | ------ | ---------------- | -------------------- | -------------------------------------------------------- |
| 1  | 0 · Scaffold | Carlitos Mari Simene | 15 Sep 09:00 | `chore: scaffold IntelCare monorepo, tooling and shared shell` |
| 2  | 1 · Accounts & Access | Julia Rica Soson | 18 Sep 21:10 | `PA-001 · Register` |
| 3  | 1 · Accounts & Access | Chennie Magbanua | 18 Sep 22:05 | `TH-001 · Log In` |
| 4  | 1 · Accounts & Access | Danziel Jean Lumactod | 19 Sep 20:40 | `A-001 · Admin Log In` |
| 5  | 2 · Profiles & User Administration | Julia Rica Soson | 25 Sep 21:00 | `PA-004 · View Profile` |
| 6  | 2 · Profiles & User Administration | Chennie Magbanua | 04 Oct 20:30 | `TH-003 · View Profile` |
| 7  | 2 · Profiles & User Administration | Danziel Jean Lumactod | 12 Oct 21:20 | `A-004 · View User` |
| 8  | 3 · Appointment Requests, Services & Scheduling | Julia Rica Soson | 17 Oct 20:15 | `PA-007 · Request Appointment` |
| 9  | 3 · Appointment Requests, Services & Scheduling | Chennie Magbanua | 22 Oct 19:40 | `PA-010 · View Upcoming Appointments` |
| 10 | 3 · Appointment Requests, Services & Scheduling | Danziel Jean Lumactod | 22 Oct 21:30 | `A-016 · Edit Therapy Service` |
| 11 | 4 · Therapist Availability & Appointment Lifecycle | Chennie Magbanua | 31 Oct 09:10 | `TH-006 · Set Working Days` |
| 12 | 4 · Therapist Availability & Appointment Lifecycle | Danziel Jean Lumactod | 31 Oct 10:05 | `A-010 · Manage Patient Information` |
| 13 | 5 · Appointment & Patient Visibility | Julia Rica Soson | 31 Oct 11:00 | `PA-013 · View Assigned Therapist` |
| 14 | 5 · Appointment & Patient Visibility | Chennie Magbanua | 31 Oct 11:45 | `TH-008 · View Assigned Appointments` |
| 15 | 5 · Appointment & Patient Visibility | Danziel Jean Lumactod | 31 Oct 13:10 | `A-028 · View Upcoming Appointments` |
| 16 | 6 · Therapy Sessions & Records | Julia Rica Soson | 31 Oct 14:00 | `PA-015 · View Session History` |
| 17 | 6 · Therapy Sessions & Records | Chennie Magbanua | 31 Oct 14:40 | `TH-015 · Record Therapy Session` |
| 18 | 6 · Therapy Sessions & Records | Danziel Jean Lumactod | 31 Oct 15:20 | `A-031 · View Session History` |
| 19 | 7 · Payments & Service Pricing | Danziel Jean Lumactod | 31 Oct 16:00 | `A-018 · Set Service Duration` |
| 20 | 7 · Payments & Service Pricing | Chennie Magbanua | 31 Oct 16:30 | `SE-008 · Record Payment` |
| 21 | 8 · Search, Filters & Reports | Danziel Jean Lumactod | 31 Oct 17:15 | `A-036 · Search Patient Records` |
| 22 | 9 · Notifications & Google Calendar | Julia Rica Soson | 31 Oct 19:00 | `PA-017 · Receive Appointment Notification` |
| 23 | 9 · Notifications & Google Calendar | Chennie Magbanua | 31 Oct 19:40 | `TH-021 · Integrate Google Calendar` |
| 24 | 9 · Notifications & Google Calendar | Danziel Jean Lumactod | 31 Oct 20:30 | `A-046 · Send Appointment Notification` |

Commit counts per person: Julia Rica Soson 6, Chennie Magbanua 8, Danziel Jean Lumactod 9, Carlitos Mari Simene 1.

---

## 6. File → commit allocation

Each of the 368 tree paths belongs to **exactly one** commit; trees are cumulative, so commit _N_ contains every path allocated to commits 1.._N_. The build script asserts full coverage and no duplicates before writing anything (§8).

| # | Allocation rule (paths relative to repo root) |
| - | --------------------------------------------- |
| 1 | All root files (`.gitignore`, `AGENTS.md`, `package*.json`, `skills-lock.json`, `physical-therapist-scheduling-system-seo.md`), all `.agents/**`, `backend/{package*.json,.env.example,assets,scripts,tmp}/**`, `backend/src/app.js`, `backend/src/config/{db,env,integrations,jwtOptions}.js`, `backend/src/middleware/**`, `backend/src/emails/**`, `backend/src/utils/{jwt,validators}.js`, `frontend/{.gitignore,README.md,eslint.config.js,index.html,package*.json,vite.config.js,public/**,src/assets/**}`, `frontend/src/{main.jsx,App.jsx,styles/index.css}`, `frontend/src/components/{ToastProvider.jsx,brand,dashboard,loading,ui}/**`, `frontend/src/config/**`, `frontend/src/context/{AuthContext.jsx,authContext.js,SidebarContext.jsx,sidebarContext.js,useAuth.js,useSidebar.js}`, `frontend/src/hooks/{useDelayedLoading,useRecaptcha}.js`, `frontend/src/layouts/**`, `frontend/src/routes/**`, `frontend/src/services/api/axiosInstance.js`, `frontend/src/utils/{toast,validators}.js`, `frontend/src/pages/{LegalPage.jsx,NotFoundPage.jsx,landing/**}` |
| 2 | `frontend/src/pages/auth/**`, `frontend/src/components/auth/RecaptchaField.jsx`, `frontend/src/services/api/{authApi,authSession}.js`, `backend/src/controller/authController.js`, `backend/src/router/authRoutes.js` |
| 3 | `frontend/src/pages/staff/{StaffAuth.jsx,ChangePasswordPage.jsx}`, `frontend/src/services/api/staffAuthApi.js` |
| 4 | `backend/src/models/userModel.js`, `backend/src/schema/authSchema.js`, `backend/src/controller/adminUserController.js`, `backend/src/router/adminUserRoutes.js`, `frontend/src/services/api/adminUserApi.js`, `frontend/src/pages/staff/admin/UserManagementPage.jsx` |
| 5 | `frontend/src/pages/patient/ProfilePage.jsx`, `frontend/src/pages/staff/shared/ProfilePage.jsx` |
| 6 | `frontend/src/pages/staff/therapist/ProfilePage.jsx`, `frontend/src/pages/staff/admin/TherapistsPage.jsx`, `backend/src/controller/therapistController.js`, `backend/src/router/therapistRoutes.js` |
| 7 | `frontend/src/pages/staff/admin/{AdminPeoplePage,ProfilePage}.jsx`, `frontend/src/pages/staff/secretary/ProfilePage.jsx`, `frontend/src/pages/staff/admin/SettingsPage.jsx`, `frontend/src/services/api/settingsApi.js`, `frontend/src/context/{SettingsContext.jsx,settingsContext.js,useSettings.js}`, backend settings stack (`backend/src/{controller/settingsController.js,router/settingsRoutes.js,services/settingsService.js,schema/settingsSchema.js}` + `models/{appSettingModel,settingsAuditLogModel,settingsVerificationModel}.js`) — admin-only tooling with no Plaky item, parked with admin user administration |
| 8 | `frontend/src/pages/patient/{BookAppointmentPage,AppointmentsPage}.jsx`, `frontend/src/services/api/patientApi.js`, `backend/src/controller/patientController.js`, `backend/src/router/patientRoutes.js`, `backend/src/models/appointmentModel.js`, `backend/src/schema/appointmentSchema.js` |
| 9 | `frontend/src/pages/patient/AppointmentDetailsPage.jsx`, `frontend/src/utils/patientFormatters.js`, `frontend/src/hooks/usePatientDashboard.js`, `backend/src/utils/appointmentDates.js` |
| 10 | `frontend/src/pages/staff/admin/{ServicesPage,AppointmentsPage}.jsx`, `frontend/src/services/api/{adminServiceApi,adminAppointmentApi}.js`, `backend/src/controller/{adminServiceController,adminAppointmentController}.js`, `backend/src/router/{adminServiceRoutes,adminAppointmentRoutes}.js`, `backend/src/models/therapyServiceModel.js`, `backend/src/config/therapyServices.js` |
| 11 | `frontend/src/pages/staff/therapist/{AvailabilityPage,MyAppointmentsPage}.jsx` |
| 12 | `frontend/src/pages/staff/admin/PatientsPage.jsx`, `frontend/src/utils/adminFormatters.js` |
| 13 | `frontend/src/pages/patient/{Dashboard,DependentsPage}.jsx`, `backend/src/models/dependentModel.js`, `backend/src/schema/dependentSchema.js` |
| 14 | `frontend/src/pages/staff/therapist/{DashboardPage,MyPatientsPage,AppointmentDetailsPage}.jsx`, `frontend/src/pages/staff/secretary/{DashboardPage,SchedulePage}.jsx`, `frontend/src/services/api/{therapistApi,secretaryApi}.js`, `backend/src/controller/secretaryController.js`, `backend/src/router/secretaryRoutes.js` |
| 15 | `frontend/src/pages/staff/admin/DashboardPage.jsx`, `frontend/src/components/staff/{AdminDashboardOverview,StaffDashboardOverview,StaffEmptyTable,StaffPageHeader,StaffSummaryGrid}.jsx` |
| 16 | `backend/src/models/sessionModel.js`, `frontend/src/pages/patient/ProgressPage.jsx` |
| 17 | `frontend/src/pages/staff/therapist/SessionRecordsPage.jsx` |
| 18 | `frontend/src/pages/staff/admin/SessionsPage.jsx`, `backend/src/router/adminRecordRoutes.js` |
| 19 | `frontend/src/pages/staff/admin/PaymentsPage.jsx` |
| 20 | `frontend/src/pages/staff/secretary/PaymentsPage.jsx` |
| 21 | `frontend/src/pages/staff/admin/ReportsPage.jsx`, `frontend/src/services/api/adminMonitoringApi.js`, `backend/src/controller/adminMonitoringController.js`, `backend/src/router/adminMonitoringRoutes.js`, `frontend/src/components/staff/{DataTable,FilterBar,SearchFilterBar,StaffTablePage,DateRangeControl,AdminPrimitives}.jsx` |
| 22 | `frontend/src/pages/patient/{NotificationsPage,SettingsPage}.jsx`, `frontend/src/context/{NotificationsContext.jsx,notificationsContext.js,useNotifications.js}` |
| 23 | `backend/src/{services/calendarService.js,controller/calendarController.js,router/calendarRoutes.js}` |
| 24 | `backend/src/{services/notificationService.js,services/mailer.js,controller/notificationController.js,router/notificationRoutes.js,router/devEmailRoutes.js,models/notificationModel.js,jobs/appointmentReminderJob.js}`, `frontend/src/services/api/notificationApi.js`, `frontend/src/components/notifications/**` |

---

## 7. Commit message format

Subject: `<ID> · <Title>` of the first (lowest-ID) Plaky item that person closed in that sprint — exactly as written on the board, with the board's `·` separator.

Body:

```

Plaky sprint: Sprint 3 — Appointment Requests, Services & Scheduling
Items closed:
- PA-010 · View Upcoming Appointments
- PA-011 · View Previous Appointments
- PA-012 · Request Rescheduling
- A-024 · Reschedule Appointment
```

Commit 1 (scaffold) is the exception: it has no Plaky item, so its subject is a plain `chore:` line and its body names Carlitos as repository owner.

No `Generated with` / `Co-Authored-By` footer on any commit.

---

## 8. Build procedure

Plumbing only — the working tree and the real index are never touched, so the pending local deletions (`.agents/**` staged in `main`) are unaffected.

1. Save the current tip: `git update-ref refs/backup/integration-pre-rewrite 32f0c41`.
2. For each of the 24 commits in order, using a throwaway index file (`GIT_INDEX_FILE`):
   - select the cumulative slice's entries from `git ls-tree -r <original tree>` and load them with `git update-index --add --index-info` (this git version's `read-tree` rejects pathspecs);
   - `git write-tree` → tree for this commit;
   - `git commit-tree <tree> -p <previous> -m <message>` with `GIT_AUTHOR_NAME/EMAIL/DATE` and `GIT_COMMITTER_NAME/EMAIL/DATE` set to the teammate and the §5 timestamp.
3. Point `refs/heads/integration` at the last commit; keep `refs/heads/main` untouched.
4. Drive it from a single script, `scripts/rewrite-integration-history.sh`, with a `--check` mode that only validates allocation coverage and prints the planned log.

---

## 9. Safety, rollback, and remote

- No push. `origin/integration` keeps pointing at `32f0c41` until the requester decides to force-push.
- Publish (only when the requester asks): `git push --force-with-lease origin integration`, then `git update-ref refs/heads/integration refs/backup/integration-pre-rewrite` is no longer needed as a fallback but should be kept until the team confirms. Collaborators then run `git fetch && git reset --hard origin/integration`.
- Rollback is one command: `git update-ref refs/heads/integration refs/backup/integration-pre-rewrite` (the backup ref is created in step 1 and never expires with the reflog).
- `main` is not rewritten, so the pre-rewrite history remains reachable from `main` as well.
- If the requester later force-pushes, every collaborator with a local `integration` must `git fetch && git reset --hard origin/integration`; this spec is the note to send them.

---

## 10. Verification checklist

| # | Check                                                                                                            |
| - | ---------------------------------------------------------------------------------------------------------------- |
| 1 | `git rev-parse integration^{tree}` == `git rev-parse origin/integration^{tree}` (byte-identical content)           |
| 2 | `git log --format='%h %an <%ae> %ad %s' --date=iso integration` shows 24 commits, in §5 order and timestamps      |
| 3 | Every commit has ≥1 file in `git show --name-only` (no empty commits)                                             |
| 4 | `git shortlog -sne integration` shows only the four teammates, with the §5 counts (6/8/9/1)                       |
| 5 | No commit is authored or committed by `Drakaniia`, `Yuan Simene`, or `dahnzel.j@gmail.com`                        |
| 6 | `git diff origin/integration integration --stat` is empty                                                         |
| 7 | Working tree still shows the same pending staged deletions as before the rewrite (nothing checked out or staged)  |

---

## 11. Limitations (accepted, do not fix)

- **Intermediate commits are not buildable.** Files are sliced by feature ownership, so e.g. `App.jsx` (routes every page) lands in commit 1 while most pages land later. Only the tip is guaranteed correct, and it is verified by tree-hash equality. Rebuilding 24 individually compiling commits is out of scope.
- **Dates are board dates, not edit times.** Sprint 2 items have no date on the board, so their commits use the approved 25 Sep–22 Oct spread.
- **Attribution is email-based.** Name/email are set exactly as specified, but GitHub shows the account link only if those emails are verified on the teammates' accounts.
- **No new content.** The rewrite does not add `docs/plaky.md` to the repository, does not change code, and does not touch `main`, `staging`, or `QA`.

---

## 12. Out of scope

- Force-pushing or opening PRs.
- Rewriting `main`, `staging`, or `QA`.
- Changing file contents, splitting files, or reformatting.
- Committing `docs/` (including this spec and `plaky.md`).
