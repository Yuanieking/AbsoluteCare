#!/usr/bin/env bash
# Rewrites the `integration` branch history to match docs/plaky.md.
# See docs/spec/integration-history-rewrite-spec.md.
#
# Usage:
#   scripts/rewrite-integration-history.sh --check   # validate + preview only
#   scripts/rewrite-integration-history.sh --build   # write the new history
#
# Only refs are touched. The working tree and the real index are never modified.

set -euo pipefail

BASE=${BASE:-$(git rev-parse --verify origin/integration)}
MODE=${1:---check}
TMPDIR_=$(mktemp -d)
trap 'rm -rf "$TMPDIR_"' EXIT

error_count=0
declare -a ALL_FILES=()
mapfile -t ALL_FILES < <(git ls-tree -r --name-only "$BASE")

declare -A CLAIMED=()
declare -A A_NAME=() A_EMAIL=() A_DATE=()
COMMIT_NO=0
: > "$TMPDIR_/cumulative.txt"

# add_commit <name> <email> <iso-date> <subject> <body> <path|dir/>...
add_commit() {
  local name=$1 email=$2 date=$3 subject=$4 body=$5
  shift 5
  COMMIT_NO=$((COMMIT_NO + 1))

  local -a slice=()
  local f p pattern_matched
  for f in "${ALL_FILES[@]}"; do
    pattern_matched=0
    for p in "$@"; do
      if [[ "$p" == */ ]]; then
        [[ "$f" == "$p"* ]] && { pattern_matched=1; break; }
      elif [[ "$f" == "$p" ]]; then
        pattern_matched=1
        break
      fi
    done
    if (( pattern_matched )); then
      if [[ -n "${CLAIMED[$f]:-}" ]]; then
        echo "DUPLICATE: $f claimed by commit ${CLAIMED[$f]} and $COMMIT_NO" >&2
        error_count=$((error_count + 1))
      else
        CLAIMED[$f]=$COMMIT_NO
        slice+=("$f")
      fi
    fi
  done

  if (( ${#slice[@]} == 0 )); then
    echo "EMPTY: commit $COMMIT_NO ($subject) claims no files" >&2
    error_count=$((error_count + 1))
  fi
  for p in "$@"; do
    case "$p" in
      */) continue ;;
    esac
    [[ -z "${CLAIMED[$p]:-}" ]] && echo "MISSING: $p does not exist in $BASE" >&2 && error_count=$((error_count + 1))
  done

  printf '%s\n' "${slice[@]}" > "$TMPDIR_/slice.$COMMIT_NO"

  A_NAME[$COMMIT_NO]=$name
  A_EMAIL[$COMMIT_NO]=$email
  A_DATE[$COMMIT_NO]=$date
  printf '%s\n\n%s\n' "$subject" "$body" > "$TMPDIR_/msg.$COMMIT_NO"

  printf '%2d  %-24s %s  (%d files)\n' "$COMMIT_NO" "$name" "$date" "${#slice[@]}"
}

# ---------------------------------------------------------------------------
# 1 · Scaffold — repository owner, no Plaky items
# ---------------------------------------------------------------------------
add_commit "Carlitos Mari Simene" "yuansimene123@gmail.com" "2026-09-15 09:00:00 +0800" \
  "chore: scaffold IntelCare monorepo, tooling and shared shell" \
  "Repository owner: Carlitos Mari Simene (@Yuanieking)
No Plaky items: repository setup, tooling, shared UI shell and assets." \
  .gitignore AGENTS.md package.json package-lock.json skills-lock.json \
  physical-therapist-scheduling-system-seo.md \
  .agents/ \
  backend/.env.example backend/package.json backend/package-lock.json \
  backend/assets/ backend/scripts/ backend/tmp/ \
  backend/src/app.js \
  backend/src/config/db.js backend/src/config/env.js backend/src/config/integrations.js backend/src/config/jwtOptions.js \
  backend/src/middleware/ backend/src/emails/ \
  backend/src/utils/jwt.js backend/src/utils/validators.js \
  frontend/.gitignore frontend/README.md frontend/eslint.config.js frontend/index.html \
  frontend/package.json frontend/package-lock.json frontend/vite.config.js \
  frontend/public/ frontend/src/assets/ \
  frontend/src/main.jsx frontend/src/App.jsx frontend/src/styles/index.css \
  frontend/src/components/ToastProvider.jsx frontend/src/components/brand/ \
  frontend/src/components/dashboard/ frontend/src/components/loading/ frontend/src/components/ui/ \
  frontend/src/config/ \
  frontend/src/context/AuthContext.jsx frontend/src/context/authContext.js \
  frontend/src/context/SidebarContext.jsx frontend/src/context/sidebarContext.js \
  frontend/src/context/useAuth.js frontend/src/context/useSidebar.js \
  frontend/src/hooks/useDelayedLoading.js frontend/src/hooks/useRecaptcha.js \
  frontend/src/layouts/ frontend/src/routes/ \
  frontend/src/services/api/axiosInstance.js \
  frontend/src/utils/toast.js frontend/src/utils/validators.js \
  frontend/src/pages/LegalPage.jsx frontend/src/pages/NotFoundPage.jsx frontend/src/pages/landing/

# ---------------------------------------------------------------------------
# Sprint 1 — Accounts & Access (17–19 Sep 2026)
# ---------------------------------------------------------------------------
add_commit "Julia Rica Soson" "2401103363@student.buksu.edu.ph" "2026-09-18 21:10:00 +0800" \
  "PA-001 · Register" \
  "Plaky sprint: Sprint 1 — Accounts & Access
Items closed:
- PA-001 · Register
- PA-002 · Log In
- PA-003 · Log Out" \
  frontend/src/pages/auth/ frontend/src/components/auth/RecaptchaField.jsx \
  frontend/src/services/api/authApi.js frontend/src/services/api/authSession.js \
  backend/src/controller/authController.js backend/src/router/authRoutes.js

add_commit "Chennie Magbanua" "2401101439@student.buksu.edu.ph" "2026-09-18 22:05:00 +0800" \
  "TH-001 · Log In" \
  "Plaky sprint: Sprint 1 — Accounts & Access
Items closed:
- TH-001 · Log In
- TH-002 · Log Out
- SE-001 · Secretary Log In
- SE-002 · Secretary Log Out" \
  frontend/src/pages/staff/StaffAuth.jsx frontend/src/pages/staff/ChangePasswordPage.jsx \
  frontend/src/services/api/staffAuthApi.js

add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-09-19 20:40:00 +0800" \
  "A-001 · Admin Log In" \
  "Plaky sprint: Sprint 1 — Accounts & Access
Items closed:
- A-001 · Admin Log In
- A-002 · Admin Log Out
- A-003 · Add User" \
  backend/src/models/userModel.js backend/src/schema/authSchema.js \
  backend/src/controller/adminUserController.js backend/src/router/adminUserRoutes.js \
  frontend/src/services/api/adminUserApi.js frontend/src/pages/staff/admin/UserManagementPage.jsx

# ---------------------------------------------------------------------------
# Sprint 2 — Profiles & User Administration (undated on the board: 25 Sep – 12 Oct)
# ---------------------------------------------------------------------------
add_commit "Julia Rica Soson" "2401103363@student.buksu.edu.ph" "2026-09-25 21:00:00 +0800" \
  "PA-004 · View Profile" \
  "Plaky sprint: Sprint 2 — Profiles & User Administration
Items closed:
- PA-004 · View Profile
- PA-005 · Edit Personal Information
- PA-006 · Edit Contact Information
- TH-005 · View Specialization
- A-012 · Manage Therapist Specialization
- SE-003 · View Profile" \
  frontend/src/pages/patient/ProfilePage.jsx frontend/src/pages/staff/shared/ProfilePage.jsx

add_commit "Chennie Magbanua" "2401101439@student.buksu.edu.ph" "2026-10-04 20:30:00 +0800" \
  "TH-003 · View Profile" \
  "Plaky sprint: Sprint 2 — Profiles & User Administration
Items closed:
- TH-003 · View Profile
- TH-004 · Edit Profile
- A-008 · Activate User
- A-009 · Deactivate User
- A-011 · Manage Therapist Information" \
  frontend/src/pages/staff/therapist/ProfilePage.jsx frontend/src/pages/staff/admin/TherapistsPage.jsx \
  backend/src/controller/therapistController.js backend/src/router/therapistRoutes.js

add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-10-12 21:20:00 +0800" \
  "A-004 · View User" \
  "Plaky sprint: Sprint 2 — Profiles & User Administration
Items closed:
- A-004 · View User
- A-005 · Edit User
- A-006 · Archive User
- SE-004 · Edit Profile

Admin settings and integrations stack has no Plaky item; it ships with admin user administration." \
  frontend/src/pages/staff/admin/AdminPeoplePage.jsx frontend/src/pages/staff/admin/ProfilePage.jsx \
  frontend/src/pages/staff/secretary/ProfilePage.jsx frontend/src/pages/staff/admin/SettingsPage.jsx \
  frontend/src/services/api/settingsApi.js frontend/src/context/SettingsContext.jsx \
  frontend/src/context/settingsContext.js frontend/src/context/useSettings.js \
  backend/src/controller/settingsController.js backend/src/router/settingsRoutes.js \
  backend/src/services/settingsService.js backend/src/schema/settingsSchema.js \
  backend/src/models/appSettingModel.js backend/src/models/settingsAuditLogModel.js \
  backend/src/models/settingsVerificationModel.js

# ---------------------------------------------------------------------------
# Sprint 3 — Appointment Requests, Services & Scheduling (through 22 Oct 2026)
# ---------------------------------------------------------------------------
add_commit "Julia Rica Soson" "2401103363@student.buksu.edu.ph" "2026-10-17 20:15:00 +0800" \
  "PA-007 · Request Appointment" \
  "Plaky sprint: Sprint 3 — Appointment Requests, Services & Scheduling
Items closed:
- PA-007 · Request Appointment
- PA-009 · View Pending Appointment Requests
- A-015 · Add Therapy Service" \
  frontend/src/pages/patient/BookAppointmentPage.jsx frontend/src/pages/patient/AppointmentsPage.jsx \
  frontend/src/services/api/patientApi.js \
  backend/src/controller/patientController.js backend/src/router/patientRoutes.js \
  backend/src/models/appointmentModel.js backend/src/schema/appointmentSchema.js

add_commit "Chennie Magbanua" "2401101439@student.buksu.edu.ph" "2026-10-22 19:40:00 +0800" \
  "PA-010 · View Upcoming Appointments" \
  "Plaky sprint: Sprint 3 — Appointment Requests, Services & Scheduling
Items closed:
- PA-010 · View Upcoming Appointments
- PA-011 · View Previous Appointments
- PA-012 · Request Rescheduling
- A-024 · Reschedule Appointment" \
  frontend/src/pages/patient/AppointmentDetailsPage.jsx \
  frontend/src/utils/patientFormatters.js frontend/src/hooks/usePatientDashboard.js \
  backend/src/utils/appointmentDates.js

add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-10-22 21:30:00 +0800" \
  "A-016 · Edit Therapy Service" \
  "Plaky sprint: Sprint 3 — Appointment Requests, Services & Scheduling
Items closed:
- A-016 · Edit Therapy Service
- A-017 · Archive Therapy Service
- A-020 · Receive Appointment Request
- A-021 · Review Appointment Request
- A-022 · Assign Therapist
- A-023 · Confirm Appointment
- A-047 · Review Therapist Reschedule Request and Approve" \
  frontend/src/pages/staff/admin/ServicesPage.jsx frontend/src/pages/staff/admin/AppointmentsPage.jsx \
  frontend/src/services/api/adminServiceApi.js frontend/src/services/api/adminAppointmentApi.js \
  backend/src/controller/adminServiceController.js backend/src/controller/adminAppointmentController.js \
  backend/src/router/adminServiceRoutes.js backend/src/router/adminAppointmentRoutes.js \
  backend/src/models/therapyServiceModel.js backend/src/config/therapyServices.js

# ---------------------------------------------------------------------------
# Sprint 4 — Therapist Availability & Appointment Lifecycle (31 Oct 2026)
# ---------------------------------------------------------------------------
add_commit "Chennie Magbanua" "2401101439@student.buksu.edu.ph" "2026-10-31 09:10:00 +0800" \
  "TH-006 · Set Working Days" \
  "Plaky sprint: Sprint 4 — Therapist Availability & Appointment Lifecycle
Items closed:
- TH-006 · Set Working Days
- TH-007 · Set Working Hours
- TH-013 · Request Rescheduling
- TH-022 · Mark Appointment as No-Show" \
  frontend/src/pages/staff/therapist/AvailabilityPage.jsx \
  frontend/src/pages/staff/therapist/MyAppointmentsPage.jsx

add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-10-31 10:05:00 +0800" \
  "A-010 · Manage Patient Information" \
  "Plaky sprint: Sprint 4 — Therapist Availability & Appointment Lifecycle
Items closed:
- A-010 · Manage Patient Information
- A-013 · Manage Therapist Working Days
- A-014 · Manage Therapist Working Hours
- A-025 · Cancel Appointment
- A-026 · Mark Appointment as Completed
- A-027 · Mark Appointment as No-Show" \
  frontend/src/pages/staff/admin/PatientsPage.jsx frontend/src/utils/adminFormatters.js

# ---------------------------------------------------------------------------
# Sprint 5 — Appointment & Patient Visibility (31 Oct 2026)
# ---------------------------------------------------------------------------
add_commit "Julia Rica Soson" "2401103363@student.buksu.edu.ph" "2026-10-31 11:00:00 +0800" \
  "PA-013 · View Assigned Therapist" \
  "Plaky sprint: Sprint 5 — Appointment & Patient Visibility
Items closed:
- PA-013 · View Assigned Therapist
- PA-014 · View Appointment Details" \
  frontend/src/pages/patient/Dashboard.jsx frontend/src/pages/patient/DependentsPage.jsx \
  backend/src/models/dependentModel.js backend/src/schema/dependentSchema.js

add_commit "Chennie Magbanua" "2401101439@student.buksu.edu.ph" "2026-10-31 11:45:00 +0800" \
  "TH-008 · View Assigned Appointments" \
  "Plaky sprint: Sprint 5 — Appointment & Patient Visibility
Items closed:
- TH-008 · View Assigned Appointments
- TH-009 · View Upcoming Appointments
- TH-010 · View Previous Appointments
- TH-011 · View Assigned Patients
- TH-012 · View Patient Appointment Details
- TH-014 · View Appointment Status
- SE-005 · View Upcoming Schedule
- SE-006 · View Appointment Details
- SE-007 · Search Appointment Schedule" \
  frontend/src/pages/staff/therapist/DashboardPage.jsx \
  frontend/src/pages/staff/therapist/MyPatientsPage.jsx \
  frontend/src/pages/staff/therapist/AppointmentDetailsPage.jsx \
  frontend/src/pages/staff/secretary/DashboardPage.jsx frontend/src/pages/staff/secretary/SchedulePage.jsx \
  frontend/src/services/api/therapistApi.js frontend/src/services/api/secretaryApi.js \
  backend/src/controller/secretaryController.js backend/src/router/secretaryRoutes.js

add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-10-31 13:10:00 +0800" \
  "A-028 · View Upcoming Appointments" \
  "Plaky sprint: Sprint 5 — Appointment & Patient Visibility
Items closed:
- A-028 · View Upcoming Appointments
- A-029 · View Previous Appointments
- A-030 · View Appointment History" \
  frontend/src/pages/staff/admin/DashboardPage.jsx \
  frontend/src/components/staff/AdminDashboardOverview.jsx \
  frontend/src/components/staff/StaffDashboardOverview.jsx \
  frontend/src/components/staff/StaffEmptyTable.jsx frontend/src/components/staff/StaffPageHeader.jsx \
  frontend/src/components/staff/StaffSummaryGrid.jsx

# ---------------------------------------------------------------------------
# Sprint 6 — Therapy Sessions & Records (31 Oct 2026)
# ---------------------------------------------------------------------------
add_commit "Julia Rica Soson" "2401103363@student.buksu.edu.ph" "2026-10-31 14:00:00 +0800" \
  "PA-015 · View Session History" \
  "Plaky sprint: Sprint 6 — Therapy Sessions & Records
Items closed:
- PA-015 · View Session History
- PA-016 · View Session Details" \
  backend/src/models/sessionModel.js frontend/src/pages/patient/ProgressPage.jsx

add_commit "Chennie Magbanua" "2401101439@student.buksu.edu.ph" "2026-10-31 14:40:00 +0800" \
  "TH-015 · Record Therapy Session" \
  "Plaky sprint: Sprint 6 — Therapy Sessions & Records
Items closed:
- TH-015 · Record Therapy Session
- TH-016 · Record Session Date
- TH-017 · Record Session Duration
- TH-018 · Record Session Notes
- TH-019 · Update Session Record
- TH-020 · View Session History" \
  frontend/src/pages/staff/therapist/SessionRecordsPage.jsx

add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-10-31 15:20:00 +0800" \
  "A-031 · View Session History" \
  "Plaky sprint: Sprint 6 — Therapy Sessions & Records
Items closed:
- A-031 · View Session History" \
  frontend/src/pages/staff/admin/SessionsPage.jsx backend/src/router/adminRecordRoutes.js

# ---------------------------------------------------------------------------
# Sprint 7 — Payments & Service Pricing (31 Oct 2026)
# ---------------------------------------------------------------------------
add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-10-31 16:00:00 +0800" \
  "A-018 · Set Service Duration" \
  "Plaky sprint: Sprint 7 — Payments & Service Pricing
Items closed:
- A-018 · Set Service Duration
- A-019 · Set Service Fee
- A-032 · Manage Payment Status
- A-033 · Mark Payment as Paid
- A-034 · Mark Payment as Unpaid
- A-035 · View Payment Status" \
  frontend/src/pages/staff/admin/PaymentsPage.jsx

add_commit "Chennie Magbanua" "2401101439@student.buksu.edu.ph" "2026-10-31 16:30:00 +0800" \
  "SE-008 · Record Payment" \
  "Plaky sprint: Sprint 7 — Payments & Service Pricing
Items closed:
- SE-008 · Record Payment
- SE-009 · Update Payment Status
- SE-010 · View Payment Status
- SE-011 · View Patient Appointment Information" \
  frontend/src/pages/staff/secretary/PaymentsPage.jsx

# ---------------------------------------------------------------------------
# Sprint 8 — Search, Filters & Reports (31 Oct 2026)
# ---------------------------------------------------------------------------
add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-10-31 17:15:00 +0800" \
  "A-036 · Search Patient Records" \
  "Plaky sprint: Sprint 8 — Search, Filters & Reports
Items closed:
- A-036 · Search Patient Records
- A-037 · Search Therapist Records
- A-038 · Search Appointment Records
- A-039 · Filter Records
- A-040 · View Patient Count Report
- A-041 · View Completed Session Report
- A-042 · View Appointment Report
- A-043 · View Therapist Workload Report
- A-044 · View Payment Report
- A-045 · View Clinic Summary Report" \
  frontend/src/pages/staff/admin/ReportsPage.jsx frontend/src/services/api/adminMonitoringApi.js \
  backend/src/controller/adminMonitoringController.js backend/src/router/adminMonitoringRoutes.js \
  frontend/src/components/staff/DataTable.jsx frontend/src/components/staff/FilterBar.jsx \
  frontend/src/components/staff/SearchFilterBar.jsx frontend/src/components/staff/StaffTablePage.jsx \
  frontend/src/components/staff/DateRangeControl.jsx frontend/src/components/staff/AdminPrimitives.jsx

# ---------------------------------------------------------------------------
# Sprint 9 — Notifications & Google Calendar (31 Oct 2026)
# ---------------------------------------------------------------------------
add_commit "Julia Rica Soson" "2401103363@student.buksu.edu.ph" "2026-10-31 19:00:00 +0800" \
  "PA-017 · Receive Appointment Notification" \
  "Plaky sprint: Sprint 9 — Notifications & Google Calendar
Items closed:
- PA-017 · Receive Appointment Notification
- PA-018 · Receive Rescheduling Notification
- PA-019 · Receive Cancellation Notification
- PA-020 · Receive Upcoming Appointment Notification
- PA-021 · Integrate Google Calendar" \
  frontend/src/pages/patient/NotificationsPage.jsx frontend/src/pages/patient/SettingsPage.jsx \
  frontend/src/context/NotificationsContext.jsx frontend/src/context/notificationsContext.js \
  frontend/src/context/useNotifications.js

add_commit "Chennie Magbanua" "2401101439@student.buksu.edu.ph" "2026-10-31 19:40:00 +0800" \
  "TH-021 · Integrate Google Calendar" \
  "Plaky sprint: Sprint 9 — Notifications & Google Calendar
Items closed:
- TH-021 · Integrate Google Calendar" \
  backend/src/services/calendarService.js backend/src/controller/calendarController.js \
  backend/src/router/calendarRoutes.js

add_commit "Danziel Jean Lumactod" "2301112832@student.buksu.edu.ph" "2026-10-31 20:30:00 +0800" \
  "A-046 · Send Appointment Notification" \
  "Plaky sprint: Sprint 9 — Notifications & Google Calendar
Items closed:
- A-046 · Send Appointment Notification" \
  backend/src/services/notificationService.js backend/src/services/mailer.js \
  backend/src/controller/notificationController.js backend/src/router/notificationRoutes.js \
  backend/src/router/devEmailRoutes.js backend/src/models/notificationModel.js \
  backend/src/jobs/appointmentReminderJob.js frontend/src/services/api/notificationApi.js \
  frontend/src/components/notifications/

# ---------------------------------------------------------------------------
# Coverage report
# ---------------------------------------------------------------------------
echo
echo "Commit plan: $COMMIT_NO commits"
unclaimed=0
for f in "${ALL_FILES[@]}"; do
  [[ -z "${CLAIMED[$f]:-}" ]] || continue
  echo "UNASSIGNED: $f" >&2
  unclaimed=$((unclaimed + 1))
done
total=${#ALL_FILES[@]}
echo "Tree files: $total, assigned: $((total - unclaimed)), unassigned: $unclaimed"
(( unclaimed > 0 )) && error_count=$((error_count + unclaimed))

if (( error_count > 0 )); then
  echo "FAILED: $error_count allocation problem(s); nothing written." >&2
  exit 1
fi

if [[ "$MODE" == "--check" ]]; then
  echo
  echo "Allocation OK. Run with --build to write the history."
  exit 0
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
echo
echo "Building commits from tree of $BASE"
git update-ref refs/backup/integration-pre-rewrite "$BASE"
echo "Backup ref: refs/backup/integration-pre-rewrite -> ${BASE:0:7}"

git ls-tree -r "$BASE" > "$TMPDIR_/full-tree.txt"

parent=""
: > "$TMPDIR_/cumulative.txt"
for (( i = 1; i <= COMMIT_NO; i++ )); do
  cat "$TMPDIR_/slice.$i" >> "$TMPDIR_/cumulative.txt"

  awk -F'\t' 'NR==FNR { want[$0] = 1; next }
    { split($1, meta, " "); if ($2 in want) print meta[1] " " meta[3] "\t" $2 }' \
    "$TMPDIR_/cumulative.txt" "$TMPDIR_/full-tree.txt" > "$TMPDIR_/index-info.txt"

  IDX="$TMPDIR_/idx.$i"
  GIT_INDEX_FILE="$IDX" git update-index --add --index-info < "$TMPDIR_/index-info.txt"
  tree=$(GIT_INDEX_FILE="$IDX" git write-tree)

  msg_args=(-F "$TMPDIR_/msg.$i")
  [[ -n "$parent" ]] && msg_args=(-p "$parent" "${msg_args[@]}")

  parent=$(
    GIT_AUTHOR_NAME="${A_NAME[$i]}" GIT_AUTHOR_EMAIL="${A_EMAIL[$i]}" GIT_AUTHOR_DATE="${A_DATE[$i]}" \
    GIT_COMMITTER_NAME="${A_NAME[$i]}" GIT_COMMITTER_EMAIL="${A_EMAIL[$i]}" GIT_COMMITTER_DATE="${A_DATE[$i]}" \
    git commit-tree "$tree" "${msg_args[@]}"
  )
  printf '%2d  %s  %s\n' "$i" "${parent:0:7}" "$(head -n 1 "$TMPDIR_/msg.$i")"
done

git update-ref refs/heads/integration "$parent"
echo
echo "integration -> ${parent:0:7}"
echo "tree $(git rev-parse integration^{tree})"
echo "base $(git rev-parse "$BASE"^{tree})"
if [[ "$(git rev-parse integration^{tree})" == "$(git rev-parse "$BASE"^{tree})" ]]; then
  echo "TREE MATCH: content is identical to $BASE"
else
  echo "TREE MISMATCH: content differs from $BASE" >&2
  exit 1
fi
