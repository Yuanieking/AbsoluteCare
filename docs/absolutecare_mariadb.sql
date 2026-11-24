-- =============================================================================
-- AbsoluteCare: normalized relational schema (MariaDB 10.4+ / XAMPP / phpMyAdmin)
--
-- Source: the Mongoose models in backend/src/models/ and the decisions in
-- docs/database-normalization-audit.md. This is a reference design only; the
-- application still runs on MongoDB and nothing here is used by the code.
--
-- Conventions
--   * Every entity table has `id BIGINT UNSIGNED AUTO_INCREMENT` as its primary key.
--     Singleton tables use `id BIGINT UNSIGNED` fixed to 1 (CHECK id = 1).
--     Pure child / junction tables use a composite primary key of their parent ids.
--   * created_at / updated_at are DATETIME(3): the app's optimistic concurrency
--     (If-Match = updatedAt) compares timestamps to the millisecond.
--   * Booleans are TINYINT(1). Money is DECIMAL(10,2). JSON is LONGTEXT + JSON_VALID.
--   * TEXT / LONGTEXT columns have no DEFAULT (portable to MariaDB 10.4 strict mode).
--   * ON DELETE: CASCADE for data owned by its parent (preferences, schedules,
--     links, notifications, edit presence); RESTRICT for clinical, billing and
--     document history; SET NULL for optional "who did it" actor columns.
--     Users and dependents are soft-deleted by the app (is_active, is_archived,
--     removed_at), so RESTRICT never blocks normal operation.
--
-- Changes against the MongoDB shape (from the audit)
--   * SettingsAuditLog removed: settings history lives in audit_logs (+ ip, meta).
--   * users.workingDays / users.workingHours removed: derived from therapist_working_hours.
--   * appointments.reminderSentAt removed: MAX(appointment_reminders.sent_at).
--   * AppSetting.auth.googleAuthEnabled / recaptchaEnabled removed: the
--     settings_integrations rows are the only toggles the code reads.
--   * users.specialization (Mixed) -> specializations + user_specializations.
--   * sessions.appointment_id is UNIQUE (closes the double-session race).
--   * Embedded history arrays (accountAudit, appointment auditLog / paymentAudit,
--     session editHistory, service auditLog) -> audit_logs (the audit's phase-2 target).
--   * GeneratedDocument.supersededBy removed: reverse of the UNIQUE supersedes_id.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS absolutecare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE absolutecare;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- People
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email                     VARCHAR(191)    NOT NULL,
  firstname                 VARCHAR(100)    NOT NULL,
  lastname                  VARCHAR(100)    NOT NULL,
  password_hash             VARCHAR(255)    NOT NULL,
  role                      ENUM('user','therapist','admin','secretary') NOT NULL DEFAULT 'user',
  auth_provider             ENUM('local','google') NOT NULL DEFAULT 'local',
  profile_picture           VARCHAR(500)    NOT NULL DEFAULT '',
  phone                     VARCHAR(20)     NOT NULL DEFAULT '',
  date_of_birth             DATE            NULL,
  address                   VARCHAR(500)    NOT NULL DEFAULT '',
  accepted_terms            TINYINT(1)      NOT NULL DEFAULT 0,
  terms_accepted_at         DATETIME(3)     NULL,
  must_change_password      TINYINT(1)      NOT NULL DEFAULT 0,
  reset_password_token_hash VARCHAR(128)    NULL,
  reset_password_expires_at DATETIME(3)     NULL,
  is_active                 TINYINT(1)      NOT NULL DEFAULT 1,
  is_archived               TINYINT(1)      NOT NULL DEFAULT 0,
  removed_at                DATETIME(3)     NULL,
  created_at                DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per channel group; replaces the nested notificationPreferences object.
-- category 'all' holds the top-level inApp / email switches.
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id  BIGINT UNSIGNED NOT NULL,
  category ENUM('all','appointmentUpdates','reminders','system') NOT NULL,
  in_app   TINYINT(1) NOT NULL DEFAULT 1,
  email    TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, category),
  CONSTRAINT fk_unp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1:1 per-user Google Calendar OAuth link (was users.googleCalendar).
CREATE TABLE IF NOT EXISTS user_google_calendars (
  user_id                 BIGINT UNSIGNED NOT NULL,
  connected               TINYINT(1)      NOT NULL DEFAULT 0,
  email                   VARCHAR(191)    NOT NULL DEFAULT '',
  calendar_id             VARCHAR(255)    NOT NULL DEFAULT 'primary',
  refresh_token_encrypted TEXT            NULL,
  connected_at            DATETIME(3)     NULL,
  needs_reconnect         TINYINT(1)      NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_ugc_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS specializations (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100)    NOT NULL,
  name_key   VARCHAR(100)    NOT NULL COMMENT 'lower(trim(name)), for case-insensitive uniqueness',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_specializations_name_key (name_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- M:N therapist <-> specialization (was the untyped users.specialization).
CREATE TABLE IF NOT EXISTS user_specializations (
  user_id           BIGINT UNSIGNED NOT NULL,
  specialization_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, specialization_id),
  KEY idx_us_specialization (specialization_id),
  CONSTRAINT fk_us_user           FOREIGN KEY (user_id)           REFERENCES users (id)           ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_us_specialization FOREIGN KEY (specialization_id) REFERENCES specializations (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Weekly schedule, one row per working day (was workingHoursByDay; the old
-- workingDays / workingHours columns are derived from these rows).
CREATE TABLE IF NOT EXISTS therapist_working_hours (
  user_id     BIGINT UNSIGNED NOT NULL,
  day_of_week ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL,
  start_time  TIME NOT NULL DEFAULT '08:00:00',
  end_time    TIME NOT NULL DEFAULT '17:00:00',
  PRIMARY KEY (user_id, day_of_week),
  CONSTRAINT chk_twh_range CHECK (end_time > start_time),
  CONSTRAINT fk_twh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-date exceptions to the weekly schedule (was dateOverrides).
CREATE TABLE IF NOT EXISTS therapist_date_overrides (
  user_id        BIGINT UNSIGNED NOT NULL,
  override_date  DATE       NOT NULL,
  is_unavailable TINYINT(1) NOT NULL DEFAULT 0,
  start_time     TIME       NOT NULL DEFAULT '08:00:00',
  end_time       TIME       NOT NULL DEFAULT '17:00:00',
  PRIMARY KEY (user_id, override_date),
  CONSTRAINT chk_tdo_range CHECK (is_unavailable = 1 OR end_time > start_time),
  CONSTRAINT fk_tdo_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A guardian's child or relative; no login of their own.
CREATE TABLE IF NOT EXISTS dependents (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  guardian_id   BIGINT UNSIGNED NOT NULL,
  first_name    VARCHAR(100)    NOT NULL,
  last_name     VARCHAR(100)    NOT NULL,
  date_of_birth DATE            NOT NULL,
  sex           VARCHAR(20)     NOT NULL DEFAULT '',
  relationship  VARCHAR(50)     NOT NULL,
  medical_notes VARCHAR(1000)   NOT NULL DEFAULT '',
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_dependents_guardian (guardian_id),
  CONSTRAINT fk_dependents_guardian FOREIGN KEY (guardian_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Catalog and booking
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS therapy_services (
  id               BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  name             VARCHAR(150)      NOT NULL,
  description      TEXT              NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  fee              DECIMAL(10,2)     NOT NULL,
  category         VARCHAR(100)      NOT NULL DEFAULT '',
  is_active        TINYINT(1)        NOT NULL DEFAULT 1,
  created_at       DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_services_active (is_active),
  CONSTRAINT chk_services_duration CHECK (duration_minutes >= 30),
  CONSTRAINT chk_services_fee CHECK (fee >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id                        BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  patient_id                BIGINT UNSIGNED   NOT NULL,
  dependent_id              BIGINT UNSIGNED   NULL,
  service_id                BIGINT UNSIGNED   NOT NULL,
  therapist_id              BIGINT UNSIGNED   NULL,
  -- Historical snapshot (kept on purpose): the service as booked. Receipts, PDFs
  -- and revenue reports must not change when the catalog price or name changes.
  service_name              VARCHAR(150)      NOT NULL DEFAULT '',
  service_duration_minutes  SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  service_fee               DECIMAL(10,2)     NOT NULL DEFAULT 0.00,
  service_category          VARCHAR(100)      NOT NULL DEFAULT '',
  requested_date            DATE              NOT NULL,
  requested_time            TIME              NOT NULL,
  scheduled_start           DATETIME(3)       NULL,
  scheduled_end             DATETIME(3)       NULL,
  status                    ENUM('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  cancel_reason             VARCHAR(500)      NOT NULL DEFAULT '',
  cancelled_by              BIGINT UNSIGNED   NULL,
  google_event_id           VARCHAR(255)      NOT NULL DEFAULT '',
  therapist_google_event_id VARCHAR(255)      NOT NULL DEFAULT '',
  google_event_link         VARCHAR(500)      NOT NULL DEFAULT '',
  notes                     VARCHAR(1000)     NOT NULL DEFAULT '',
  no_show_marked_by         BIGINT UNSIGNED   NULL,
  -- Historical snapshot (kept on purpose): the marker's role at the time; roles change.
  no_show_marked_role       ENUM('admin','therapist') NULL,
  no_show_marked_at         DATETIME(3)       NULL,
  created_at                DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_appt_patient_status_start (patient_id, status, scheduled_start),
  KEY idx_appt_status_start (status, scheduled_start),
  KEY idx_appt_therapist_start (therapist_id, scheduled_start),
  KEY idx_appt_dependent (dependent_id),
  KEY idx_appt_service (service_id),
  KEY idx_appt_cancelled_by (cancelled_by),
  KEY idx_appt_no_show_marked_by (no_show_marked_by),
  CONSTRAINT chk_appt_schedule CHECK (scheduled_start IS NULL OR scheduled_end IS NULL OR scheduled_end > scheduled_start),
  CONSTRAINT chk_appt_fee CHECK (service_fee >= 0),
  CONSTRAINT fk_appt_patient      FOREIGN KEY (patient_id)        REFERENCES users (id)            ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appt_dependent    FOREIGN KEY (dependent_id)      REFERENCES dependents (id)       ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appt_service      FOREIGN KEY (service_id)        REFERENCES therapy_services (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appt_therapist    FOREIGN KEY (therapist_id)      REFERENCES users (id)            ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appt_cancelled_by FOREIGN KEY (cancelled_by)      REFERENCES users (id)            ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_appt_no_show_by   FOREIGN KEY (no_show_marked_by) REFERENCES users (id)            ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1:1 payment record (was the embedded appointments.payment object).
-- amount is the money actually received: a transaction fact, not derived from service_fee.
CREATE TABLE IF NOT EXISTS appointment_payments (
  appointment_id   BIGINT UNSIGNED NOT NULL,
  status           ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  amount           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  method           ENUM('cash','gcash','card','other') NOT NULL DEFAULT 'cash',
  reference_number VARCHAR(100)    NOT NULL DEFAULT '',
  recorded_by      BIGINT UNSIGNED NULL,
  recorded_at      DATETIME(3)     NULL,
  notes            VARCHAR(1000)   NOT NULL DEFAULT '',
  PRIMARY KEY (appointment_id),
  KEY idx_ap_status_recorded (status, recorded_at),
  KEY idx_ap_recorded_by (recorded_by),
  CONSTRAINT chk_ap_amount CHECK (amount >= 0),
  CONSTRAINT fk_ap_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ap_recorded_by FOREIGN KEY (recorded_by)    REFERENCES users (id)        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The latest reschedule request per appointment (was rescheduleRequest).
-- No row means status "none".
CREATE TABLE IF NOT EXISTS appointment_reschedule_requests (
  appointment_id BIGINT UNSIGNED NOT NULL,
  status         ENUM('requested','approved','declined') NOT NULL DEFAULT 'requested',
  proposed_date  DATE            NOT NULL,
  proposed_time  TIME            NOT NULL,
  reason         VARCHAR(500)    NOT NULL DEFAULT '',
  requested_by   ENUM('patient','therapist') NOT NULL DEFAULT 'patient',
  requested_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (appointment_id),
  CONSTRAINT fk_arr_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per reminder sent (was remindersSentHours[]; replaces reminderSentAt).
-- The PK makes "send each lead time once" a database guarantee.
CREATE TABLE IF NOT EXISTS appointment_reminders (
  appointment_id BIGINT UNSIGNED   NOT NULL,
  lead_hours     SMALLINT UNSIGNED NOT NULL,
  sent_at        DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (appointment_id, lead_hours),
  CONSTRAINT fk_ar_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clinical record of a completed visit. Exactly one per appointment.
-- patient / dependent / therapist / service are NOT copied here (the MongoDB model
-- copies them to avoid a $lookup); in SQL they are one join away through
-- appointment_id, and the appointment is frozen once it is completed.
CREATE TABLE IF NOT EXISTS sessions (
  id                    BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  appointment_id        BIGINT UNSIGNED   NOT NULL,
  session_date          DATETIME(3)       NOT NULL,
  duration_minutes      SMALLINT UNSIGNED NOT NULL,
  patient_visible_notes TEXT              NULL,
  clinical_notes        TEXT              NULL,
  edited_at             DATETIME(3)       NULL,
  created_at            DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_appointment (appointment_id),
  KEY idx_sessions_date (session_date),
  CONSTRAINT chk_sessions_duration CHECK (duration_minutes BETWEEN 30 AND 240),
  CONSTRAINT fk_sessions_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Documents
-- -----------------------------------------------------------------------------

-- Atomic tracking-number sequence per document type and clinic year
-- (was key "PREFIX-YEAR"; prefix RPT/PTS/VIS/RCP follows from document_type).
CREATE TABLE IF NOT EXISTS document_counters (
  id            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  document_type ENUM('clinic_report','patient_summary','visit_record','receipt') NOT NULL,
  counter_year  SMALLINT UNSIGNED NOT NULL,
  seq           INT UNSIGNED      NOT NULL DEFAULT 0,
  created_at    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_counters_type_year (document_type, counter_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS generated_documents (
  id                    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  tracking_number       VARCHAR(32)      NOT NULL,
  document_type         ENUM('clinic_report','patient_summary','visit_record','receipt') NOT NULL,
  -- Historical snapshot (kept on purpose): what the issued PDF says. Verification
  -- must show the document exactly as issued, even if names change later.
  title                 VARCHAR(255)     NOT NULL,
  subject               VARCHAR(255)     NOT NULL DEFAULT '',
  status                ENUM('issued','superseded','revoked') NOT NULL DEFAULT 'issued',
  file_uuid             CHAR(36)         NOT NULL COMMENT 'local file id (crypto.randomUUID), not the Drive id',
  file_name             VARCHAR(255)     NOT NULL,
  mime_type             VARCHAR(100)     NOT NULL DEFAULT 'application/pdf',
  size_bytes            INT UNSIGNED     NOT NULL DEFAULT 0,
  sha256                CHAR(64)         NULL,
  pdf                   LONGBLOB         NULL COMMENT 'never selected by list queries',
  patient_id            BIGINT UNSIGNED  NULL,
  dependent_id          BIGINT UNSIGNED  NULL,
  appointment_id        BIGINT UNSIGNED  NULL,
  range_from            DATETIME(3)      NULL,
  range_to              DATETIME(3)      NULL,
  generated_by          BIGINT UNSIGNED  NOT NULL,
  -- Historical snapshot (kept on purpose): the issuer as they were at issue time.
  generated_by_role     ENUM('admin','secretary','therapist') NOT NULL,
  generated_by_name     VARCHAR(201)     NOT NULL DEFAULT '',
  -- supersededBy is the reverse of this column; UNIQUE keeps that lookup O(1).
  supersedes_id         BIGINT UNSIGNED  NULL,
  revoked_at            DATETIME(3)      NULL,
  revoked_by            BIGINT UNSIGNED  NULL,
  revoke_reason         VARCHAR(500)     NOT NULL DEFAULT '',
  -- Google Drive upload state (was the embedded drive object; depends only on id).
  drive_status          ENUM('pending','uploaded','failed') NOT NULL DEFAULT 'pending',
  drive_file_id         VARCHAR(255)     NOT NULL DEFAULT '',
  drive_web_view_link   VARCHAR(500)     NOT NULL DEFAULT '',
  drive_folder_id       VARCHAR(255)     NOT NULL DEFAULT '',
  drive_attempts        INT UNSIGNED     NOT NULL DEFAULT 0,
  drive_last_error      VARCHAR(1000)    NOT NULL DEFAULT '',
  drive_last_attempt_at DATETIME(3)      NULL,
  drive_next_attempt_at DATETIME(3)      NULL,
  drive_uploaded_at     DATETIME(3)      NULL,
  drive_lock_token      VARCHAR(64)      NOT NULL DEFAULT '',
  drive_lock_expires_at DATETIME(3)      NULL,
  created_at            DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_docs_tracking_number (tracking_number),
  UNIQUE KEY uq_docs_file_uuid (file_uuid),
  UNIQUE KEY uq_docs_supersedes (supersedes_id),
  KEY idx_docs_type_created (document_type, created_at),
  KEY idx_docs_patient_created (patient_id, created_at),
  KEY idx_docs_appointment (appointment_id),
  KEY idx_docs_dependent (dependent_id),
  KEY idx_docs_generated_by (generated_by),
  KEY idx_docs_revoked_by (revoked_by),
  KEY idx_docs_drive_queue (drive_status, drive_next_attempt_at),
  CONSTRAINT fk_docs_patient      FOREIGN KEY (patient_id)     REFERENCES users (id)               ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_docs_dependent    FOREIGN KEY (dependent_id)   REFERENCES dependents (id)          ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_docs_appointment  FOREIGN KEY (appointment_id) REFERENCES appointments (id)        ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_docs_generated_by FOREIGN KEY (generated_by)   REFERENCES users (id)               ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_docs_supersedes   FOREIGN KEY (supersedes_id)  REFERENCES generated_documents (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_docs_revoked_by   FOREIGN KEY (revoked_by)     REFERENCES users (id)               ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Notifications and audit
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  type           ENUM(
                   'appointment_requested','appointment_confirmed','appointment_assigned',
                   'appointment_rescheduled','appointment_cancelled','appointment_reminder',
                   'appointment_notice','reschedule_requested','reschedule_approved',
                   'reschedule_declined','session_recorded','payment_recorded',
                   'account_update','system','appointment_request','appointment_completed',
                   'appointment_no_show','reschedule_request_update','availability_updated'
                 ) NOT NULL,
  -- Historical snapshot (kept on purpose): a notification is an immutable message,
  -- so title / message / dependent are stored as delivered.
  title          VARCHAR(255)    NOT NULL,
  message        VARCHAR(2000)   NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  dependent_id   BIGINT UNSIGNED NULL,
  link           VARCHAR(500)    NOT NULL DEFAULT '',
  is_read        TINYINT(1)      NOT NULL DEFAULT 0,
  read_at        DATETIME(3)     NULL,
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_notif_user_created (user_id, created_at),
  KEY idx_notif_user_read_created (user_id, is_read, created_at),
  KEY idx_notif_appointment (appointment_id),
  KEY idx_notif_dependent (dependent_id),
  CONSTRAINT fk_notif_user        FOREIGN KEY (user_id)        REFERENCES users (id)        ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_notif_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notif_dependent   FOREIGN KEY (dependent_id)   REFERENCES dependents (id)   ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unified append-only audit trail. Absorbs SettingsAuditLog (ip, meta) and the
-- embedded history arrays (details, plus status moves as audit_log_changes rows).
-- No retention / TTL: rows are never updated or deleted by the app.
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_key     VARCHAR(191)    NULL COMMENT 'idempotency key for imports, e.g. legacy:... / settings:...',
  logged_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actor_id      BIGINT UNSIGNED NULL,
  -- Historical snapshot (kept on purpose): the actor's name and role at the time
  -- of the event; the audit trail must not change when a user is renamed or re-roled.
  actor_name    VARCHAR(201)    NOT NULL DEFAULT 'System',
  actor_role    ENUM('user','therapist','admin','secretary','system') NOT NULL DEFAULT 'system',
  category      ENUM('account','patient','appointment','payment','session','service',
                     'document','settings','integration','notification','backup') NOT NULL,
  action        VARCHAR(100)    NOT NULL,
  resource_type VARCHAR(50)     NOT NULL,
  resource_id   VARCHAR(64)     NOT NULL DEFAULT '' COMMENT 'polymorphic id of any table, no FK by design',
  result        ENUM('success','failure') NOT NULL DEFAULT 'success',
  details       VARCHAR(1000)   NOT NULL DEFAULT '',
  request_id    VARCHAR(64)     NOT NULL DEFAULT '',
  source        ENUM('live','legacy','system') NOT NULL DEFAULT 'live',
  ip            VARCHAR(45)     NOT NULL DEFAULT '',
  meta          LONGTEXT        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_audit_event_key (event_key),
  KEY idx_audit_logged (logged_at, id),
  KEY idx_audit_actor_logged (actor_id, logged_at),
  KEY idx_audit_category_logged (category, logged_at),
  KEY idx_audit_resource (resource_type, resource_id),
  CONSTRAINT chk_audit_meta_json CHECK (meta IS NULL OR JSON_VALID(meta)),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Field-level before/after values of one audit event (was changes[]).
CREATE TABLE IF NOT EXISTS audit_log_changes (
  audit_log_id BIGINT UNSIGNED NOT NULL,
  field_name   VARCHAR(160)    NOT NULL,
  before_value LONGTEXT        NULL,
  after_value  LONGTEXT        NULL,
  PRIMARY KEY (audit_log_id, field_name),
  CONSTRAINT chk_alc_before_json CHECK (before_value IS NULL OR JSON_VALID(before_value)),
  CONSTRAINT chk_alc_after_json  CHECK (after_value IS NULL OR JSON_VALID(after_value)),
  CONSTRAINT fk_alc_audit_log FOREIGN KEY (audit_log_id) REFERENCES audit_logs (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users an audit event is about (was subjects[]); drives "my activity" views.
CREATE TABLE IF NOT EXISTS audit_log_subjects (
  audit_log_id BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (audit_log_id, user_id),
  KEY idx_als_user (user_id),
  CONSTRAINT fk_als_audit_log FOREIGN KEY (audit_log_id) REFERENCES audit_logs (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_als_user      FOREIGN KEY (user_id)      REFERENCES users (id)      ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Clinic settings (singleton) and its multi-valued parts
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_settings (
  id                                BIGINT UNSIGNED   NOT NULL DEFAULT 1,
  -- general
  clinic_name                       VARCHAR(150)      NOT NULL DEFAULT 'AbsoluteCare Physical Therapy',
  clinic_address                    VARCHAR(500)      NOT NULL DEFAULT '',
  clinic_phone                      VARCHAR(20)       NOT NULL DEFAULT '',
  clinic_email                      VARCHAR(191)      NOT NULL DEFAULT '',
  timezone                          VARCHAR(64)       NOT NULL DEFAULT 'Asia/Manila',
  currency                          CHAR(3)           NOT NULL DEFAULT 'PHP',
  logo_url                          VARCHAR(500)      NOT NULL DEFAULT '',
  -- auth (googleAuthEnabled / recaptchaEnabled live in settings_integrations only)
  patient_registration_enabled      TINYINT(1)        NOT NULL DEFAULT 1,
  email_verification_required       TINYINT(1)        NOT NULL DEFAULT 0,
  password_min_length               TINYINT UNSIGNED  NOT NULL DEFAULT 8,
  session_timeout_minutes           SMALLINT UNSIGNED NOT NULL DEFAULT 480,
  max_login_attempts                TINYINT UNSIGNED  NOT NULL DEFAULT 5,
  lockout_minutes                   SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  terms_version                     VARCHAR(30)       NOT NULL DEFAULT '1.0',
  secretary_can_open_documents      TINYINT(1)        NOT NULL DEFAULT 1,
  secretary_can_view_drive_status   TINYINT(1)        NOT NULL DEFAULT 1,
  therapist_can_open_documents      TINYINT(1)        NOT NULL DEFAULT 1,
  -- booking
  online_booking_enabled            TINYINT(1)        NOT NULL DEFAULT 1,
  min_notice_hours                  SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  max_advance_days                  SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  slot_interval_minutes             TINYINT UNSIGNED  NOT NULL DEFAULT 30,
  max_pending_requests_per_patient  TINYINT UNSIGNED  NOT NULL DEFAULT 3,
  allow_dependents                  TINYINT(1)        NOT NULL DEFAULT 1,
  patient_cancel_cutoff_hours       SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  reschedule_cutoff_hours           SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  patient_can_cancel                TINYINT(1)        NOT NULL DEFAULT 1,
  -- schedule
  open_hours_start                  TIME              NOT NULL DEFAULT '08:00:00',
  open_hours_end                    TIME              NOT NULL DEFAULT '17:00:00',
  -- notifications
  notify_email_enabled              TINYINT(1)        NOT NULL DEFAULT 1,
  notify_in_app_enabled             TINYINT(1)        NOT NULL DEFAULT 1,
  reminders_enabled                 TINYINT(1)        NOT NULL DEFAULT 1,
  sender_name                       VARCHAR(150)      NOT NULL DEFAULT 'AbsoluteCare Physical Therapy',
  -- payments
  require_reference_for_non_cash    TINYINT(1)        NOT NULL DEFAULT 0,
  -- integrations: restart bookkeeping (per-integration toggles are in settings_integrations)
  restart_required                  TINYINT(1)        NOT NULL DEFAULT 0,
  restart_requested_at              DATETIME(3)       NULL,
  restart_requested_by              BIGINT UNSIGNED   NULL,
  restart_applied_version           INT UNSIGNED      NOT NULL DEFAULT 0,
  -- system
  maintenance_mode                  TINYINT(1)        NOT NULL DEFAULT 0,
  maintenance_message               VARCHAR(500)      NOT NULL DEFAULT 'We are making a few improvements. Please check back soon.',
  announcement_enabled              TINYINT(1)        NOT NULL DEFAULT 0,
  announcement_message              VARCHAR(500)      NOT NULL DEFAULT '',
  announcement_type                 ENUM('info','warning') NOT NULL DEFAULT 'info',
  announcement_expires_at           DATETIME(3)       NULL,
  -- bookkeeping
  updated_by                        BIGINT UNSIGNED   NULL,
  version                           INT UNSIGNED      NOT NULL DEFAULT 1,
  edit_lease                        VARCHAR(64)       NULL,
  edit_lease_expires_at             DATETIME(3)       NULL,
  created_at                        DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                        DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_settings_updated_by (updated_by),
  KEY idx_settings_restart_by (restart_requested_by),
  CONSTRAINT chk_settings_singleton CHECK (id = 1),
  CONSTRAINT chk_settings_password_len CHECK (password_min_length BETWEEN 8 AND 32),
  CONSTRAINT chk_settings_session_timeout CHECK (session_timeout_minutes BETWEEN 15 AND 1440),
  CONSTRAINT chk_settings_login_attempts CHECK (max_login_attempts BETWEEN 3 AND 10),
  CONSTRAINT chk_settings_lockout CHECK (lockout_minutes BETWEEN 1 AND 1440),
  CONSTRAINT chk_settings_min_notice CHECK (min_notice_hours <= 720),
  CONSTRAINT chk_settings_max_advance CHECK (max_advance_days BETWEEN 1 AND 365),
  CONSTRAINT chk_settings_slot CHECK (slot_interval_minutes IN (15, 30, 60)),
  CONSTRAINT chk_settings_pending CHECK (max_pending_requests_per_patient BETWEEN 1 AND 20),
  CONSTRAINT chk_settings_cancel_cutoff CHECK (patient_cancel_cutoff_hours <= 720),
  CONSTRAINT chk_settings_reschedule_cutoff CHECK (reschedule_cutoff_hours <= 720),
  CONSTRAINT chk_settings_open_hours CHECK (open_hours_end > open_hours_start),
  CONSTRAINT fk_settings_updated_by FOREIGN KEY (updated_by)           REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_settings_restart_by FOREIGN KEY (restart_requested_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Days the clinic is open (was schedule.openDays[]).
CREATE TABLE IF NOT EXISTS settings_open_days (
  settings_id BIGINT UNSIGNED NOT NULL,
  day_of_week ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL,
  PRIMARY KEY (settings_id, day_of_week),
  CONSTRAINT fk_sod_settings FOREIGN KEY (settings_id) REFERENCES app_settings (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clinic closures (was schedule.closedDates[]).
CREATE TABLE IF NOT EXISTS settings_closed_dates (
  settings_id BIGINT UNSIGNED NOT NULL,
  closed_date DATE            NOT NULL,
  reason      VARCHAR(255)    NOT NULL DEFAULT '',
  PRIMARY KEY (settings_id, closed_date),
  CONSTRAINT fk_scd_settings FOREIGN KEY (settings_id) REFERENCES app_settings (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hours before an appointment at which reminders go out (was reminderLeadHours[]).
CREATE TABLE IF NOT EXISTS settings_reminder_lead_hours (
  settings_id BIGINT UNSIGNED   NOT NULL,
  lead_hours  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (settings_id, lead_hours),
  CONSTRAINT fk_srlh_settings FOREIGN KEY (settings_id) REFERENCES app_settings (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment methods the clinic accepts (was payments.enabledMethods[]).
-- Capitalised values match the settings model; appointment_payments.method is lowercase like its model.
CREATE TABLE IF NOT EXISTS settings_payment_methods (
  settings_id BIGINT UNSIGNED NOT NULL,
  method      ENUM('Cash','GCash','Card','Other') NOT NULL,
  PRIMARY KEY (settings_id, method),
  CONSTRAINT fk_spm_settings FOREIGN KEY (settings_id) REFERENCES app_settings (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RBAC matrix: role x area x action (was auth.permissions.<role>.<area>.{crud}).
-- The 'user' role only uses the myActivity area.
CREATE TABLE IF NOT EXISTS settings_role_permissions (
  settings_id BIGINT UNSIGNED NOT NULL,
  role        ENUM('secretary','therapist','user') NOT NULL,
  area        ENUM('dashboard','appointments','services','sessions','patients','payments',
                   'reports','documents','myActivity','userManagement','settings') NOT NULL,
  can_create  TINYINT(1) NOT NULL DEFAULT 0,
  can_read    TINYINT(1) NOT NULL DEFAULT 1,
  can_update  TINYINT(1) NOT NULL DEFAULT 0,
  can_delete  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (settings_id, role, area),
  CONSTRAINT fk_srp_settings FOREIGN KEY (settings_id) REFERENCES app_settings (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per integration: enabled toggle + last connection test (was the
-- integrations.*Enabled / *LastTest pairs).
CREATE TABLE IF NOT EXISTS settings_integrations (
  settings_id BIGINT UNSIGNED NOT NULL,
  integration ENUM('googleAuth','recaptcha','googleCalendar','googleDrive','googleMaps',
                   'email','reportGeneration') NOT NULL,
  is_enabled  TINYINT(1) NOT NULL DEFAULT 1,
  last_test   LONGTEXT   NULL,
  PRIMARY KEY (settings_id, integration),
  CONSTRAINT chk_si_last_test_json CHECK (last_test IS NULL OR JSON_VALID(last_test)),
  CONSTRAINT fk_si_settings FOREIGN KEY (settings_id) REFERENCES app_settings (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Integrations and security
-- -----------------------------------------------------------------------------

-- Encrypted key/value secrets for the integration groups (config/integrationKeys.js).
CREATE TABLE IF NOT EXISTS integration_credentials (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  credential_key     VARCHAR(100)    NOT NULL,
  credential_group   VARCHAR(50)     NOT NULL,
  value_encrypted    TEXT            NULL,
  value_hash         VARCHAR(128)    NOT NULL DEFAULT '',
  previous_encrypted TEXT            NULL,
  fingerprint        VARCHAR(128)    NOT NULL DEFAULT '',
  verified_at        DATETIME(3)     NULL,
  updated_by         BIGINT UNSIGNED NULL,
  cleared_at         DATETIME(3)     NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ic_key (credential_key),
  KEY idx_ic_group (credential_group),
  KEY idx_ic_updated_by (updated_by),
  CONSTRAINT fk_ic_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The clinic's single Google Drive OAuth connection (singleton, was key "clinic").
CREATE TABLE IF NOT EXISTS google_drive_connections (
  id                      BIGINT UNSIGNED NOT NULL DEFAULT 1,
  connected               TINYINT(1)      NOT NULL DEFAULT 0,
  email                   VARCHAR(191)    NOT NULL DEFAULT '',
  refresh_token_encrypted TEXT            NULL,
  root_folder_id          VARCHAR(255)    NOT NULL DEFAULT '',
  connected_at            DATETIME(3)     NULL,
  connected_by            BIGINT UNSIGNED NULL,
  needs_reconnect         TINYINT(1)      NOT NULL DEFAULT 0,
  last_error              VARCHAR(1000)   NOT NULL DEFAULT '',
  created_at              DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_gdc_connected_by (connected_by),
  CONSTRAINT chk_gdc_singleton CHECK (id = 1),
  CONSTRAINT fk_gdc_connected_by FOREIGN KEY (connected_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One-time codes for sensitive admin actions. MongoDB expires these with a TTL
-- index; in SQL, purge rows with expires_at < NOW() from a scheduled job or event.
CREATE TABLE IF NOT EXISTS settings_verifications (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  admin_id    BIGINT UNSIGNED  NOT NULL,
  action      VARCHAR(100)     NOT NULL,
  digest      VARCHAR(128)     NOT NULL DEFAULT '',
  code_hash   VARCHAR(128)     NOT NULL,
  expires_at  DATETIME(3)      NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  consumed_at DATETIME(3)      NULL,
  created_at  DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sv_admin_action (admin_id, action),
  KEY idx_sv_expires (expires_at),
  CONSTRAINT fk_sv_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Who is editing which record right now (was RecordEditors.activeEditors[]).
-- record_id is polymorphic over record_kind, so it has no FK; for 'settings' it is 1.
-- The editor's display name is not copied (2NF): join users. Purge rows whose
-- expires_at has passed (MongoDB used a TTL index).
CREATE TABLE IF NOT EXISTS record_editors (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_kind  ENUM('users','dependents','appointments','sessions','services','settings') NOT NULL,
  record_id    BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  session_id   VARCHAR(64)     NOT NULL COMMENT 'browser tab / client session id',
  joined_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at   DATETIME(3)     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_re_presence (record_kind, record_id, user_id, session_id),
  KEY idx_re_user (user_id),
  KEY idx_re_expires (expires_at),
  CONSTRAINT fk_re_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
