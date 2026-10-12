import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Copy,
  ExternalLink,
  FileClock,
  Globe2,
  Info,
  KeyRound,
  LoaderCircle,
  Mail,
  Search,
  Save,
  Settings2,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from "lucide-react";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import {
  Button,
  StatusBadge,
  DashboardEmptyState,
} from "../../../components/dashboard/DashboardPrimitives";
import Skeleton from "../../../components/loading/Skeleton";
import {
  confirmSettingsVerification,
  getAdminSettings,
  getIntegrationHealth,
  getIntegrations,
  getSettingsAudit,
  sendSettingsTestEmail,
  testIntegration,
  updateIntegration,
  updateSettingsSection,
} from "../../../services/api/settingsApi";
import { showError, showSuccess } from "../../../utils/toast";

const sections = [
  {
    key: "general",
    label: "General",
    title: "General",
    group: "Clinic",
    icon: Store,
    description: "Keep the clinic identity and regional details patients see.",
  },
  {
    key: "schedule",
    label: "Schedule",
    title: "Schedule and closures",
    group: "Clinic",
    icon: CalendarDays,
    description: "Set opening hours and days the clinic is closed.",
  },
  {
    key: "booking",
    label: "Booking",
    title: "Booking",
    group: "Clinic",
    icon: ClipboardList,
    description: "Control when and how patients can request appointments.",
  },
  {
    key: "auth",
    label: "Authentication",
    title: "Authentication",
    group: "Access",
    icon: KeyRound,
    description: "Manage patient access, passwords, and account rules.",
  },
  {
    key: "integrations",
    label: "Integrations",
    title: "Integrations",
    group: "Access",
    icon: Globe2,
    description: "Connect the services that support the clinic app.",
  },
  {
    key: "notifications",
    label: "Notifications",
    title: "Notifications",
    group: "Operations",
    icon: Bell,
    description: "Choose which messages the clinic sends and when.",
  },
  {
    key: "payments",
    label: "Payments",
    title: "Payments",
    group: "Operations",
    icon: CircleDollarSign,
    description: "Choose payment methods and reference requirements.",
  },
  {
    key: "system",
    label: "Maintenance",
    title: "Maintenance",
    group: "Operations",
    icon: Settings2,
    description: "Control maintenance mode and patient announcements.",
  },
  {
    key: "audit",
    label: "Audit log",
    title: "Audit log",
    group: "Operations",
    icon: FileClock,
    description: "Review who changed clinic-wide settings and when.",
  },
];
const sectionMap = Object.fromEntries(
  sections.map((section) => [section.key, section]),
);

function SettingsSection({ section, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-heading">
        <span className="settings-eyebrow">CONFIGURATION</span>
        <h2>{section.title}</h2>
        <p>{section.description}</p>
      </div>
      {children}
    </div>
  );
}

function SettingsCard({
  title,
  description,
  action,
  footer,
  children,
  className = "",
}) {
  return (
    <article className={`settings-card ${className}`.trim()}>
      <header className="settings-card-header">
        {title && (
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        )}
        {action && <div className="settings-card-action">{action}</div>}
      </header>
      {children}
      {footer && <footer className="settings-card-footer">{footer}</footer>}
    </article>
  );
}

function SettingRow({ label, helper, children, error, disabled = false }) {
  return (
    <div className={`setting-row${disabled ? " is-disabled" : ""}`}>
      <div className="setting-row-copy">
        <strong>{label}</strong>
        <p>{helper}</p>
        {error && (
          <span className="setting-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  loading = false,
  describedBy,
}) {
  return (
    <button
      className={`settings-switch${checked ? " is-on" : ""}`}
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
    >
      <span>
        {loading ? (
          <LoaderCircle className="settings-spin" size={14} />
        ) : checked ? (
          "On"
        ) : (
          "Off"
        )}
      </span>
      <i aria-hidden="true" />
    </button>
  );
}

function NumberStepper({ value, onChange, min, max, unit }) {
  return (
    <label className="settings-input-with-unit">
      <input
        className="settings-input settings-number"
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>{unit}</span>
    </label>
  );
}

function SelectField({ value, onChange, children, ariaLabel }) {
  return (
    <label className="settings-select-wrap">
      <select
        className="settings-input settings-select"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}

function TextField({ value, onChange, type = "text", placeholder }) {
  return (
    <input
      className="settings-input"
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ChipToggleGroup({ options, value = [], onChange }) {
  return (
    <div className="settings-chip-group">
      {options.map((option) => {
        const active = value.includes(option);
        return (
          <button
            className={`settings-chip${active ? " is-active" : ""}`}
            type="button"
            key={option}
            aria-pressed={active}
            onClick={() =>
              onChange(
                active
                  ? value.filter((item) => item !== option)
                  : [...value, option],
              )
            }
          >
            {active && <Check size={13} aria-hidden="true" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}

function InlineNote({ type = "info", children }) {
  return (
    <div
      className={`settings-inline-note is-${type}`}
      role={type === "danger" ? "alert" : undefined}
    >
      <Info size={15} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function AttentionBanner({ children, href }) {
  return (
    <div className="settings-attention" role="status">
      <AlertTriangle size={17} aria-hidden="true" />
      <span>{children}</span>
      {href && <a href={href}>Set up</a>}
    </div>
  );
}

function StickySaveBar({ dirty, saving, onSave, onDiscard }) {
  if (!dirty) return null;
  return (
    <div className="settings-savebar" role="status" aria-live="polite">
      <span>You have unsaved changes</span>
      <div>
        <Button variant="secondary" disabled={saving} onClick={onDiscard}>
          <X size={16} /> Discard
        </Button>
        <Button disabled={saving} onClick={onSave}>
          {saving ? (
            <LoaderCircle className="settings-spin" size={16} />
          ) : (
            <Save size={16} />
          )}
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="settings-section-skeleton">
      <Skeleton variant="heading" width="35%" height="28px" />
      <Skeleton variant="text" width="55%" />
      <SettingsCard>
        <Skeleton height="64px" />
        <Skeleton height="64px" />
        <Skeleton height="64px" />
      </SettingsCard>
      <SettingsCard>
        <Skeleton height="120px" />
      </SettingsCard>
    </div>
  );
}

function Status({ configured, label }) {
  const status = label || (configured ? "Configured" : "Not configured");
  return (
    <span
      className={`settings-status-badge ${configured ? "is-good" : "is-warning"}`}
    >
      {configured ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : (
        <AlertTriangle size={14} aria-hidden="true" />
      )}
      <StatusBadge status={status} />
    </span>
  );
}

function GhostAction({ children, icon, onClick, href }) {
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  return href ? (
    <a className="integration-ghost-action" href={href}>
      {content}
    </a>
  ) : (
    <button
      className="integration-ghost-action"
      type="button"
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function IntegrationCard({
  id,
  icon,
  title,
  description,
  configured,
  checked,
  onChange,
  meta,
  setupHint,
  footer,
  children,
  loading = false,
  statusLabel,
}) {
  const descriptionId = `${id}-description`;
  return (
    <article
      className={`integration-card${checked ? " is-enabled" : ""}`}
      id={id}
    >
      <div className="integration-card-main">
        <span className="integration-icon-tile" aria-hidden="true">
          {icon}
        </span>
        <div className="integration-card-copy">
          <div className="integration-card-title-row">
            <h3>{title}</h3>
            <Status configured={configured} label={statusLabel} />
          </div>
          <p id={descriptionId} className="integration-description">
            {description}
          </p>
          <p className="integration-meta">{meta}</p>
          {setupHint && (
            <InlineNote type="warning">
              {setupHint}{" "}
              <a href="#integration-setup-guide">View setup guide</a>
            </InlineNote>
          )}
          {children}
        </div>
        {onChange && (
          <Switch
            label={`${title}: ${checked ? "On" : "Off"}`}
            checked={checked}
            onChange={onChange}
            disabled={!configured}
            loading={loading}
            describedBy={descriptionId}
          />
        )}
      </div>
      <footer className="integration-card-footer">{footer}</footer>
    </article>
  );
}

function VerificationDialog({ action, onClose, onConfirmed }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  async function submit() {
    setSending(true);
    setError("");
    try {
      const response = await confirmSettingsVerification(action, code.join(""));
      onConfirmed(response.data.verificationToken);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "The verification code could not be confirmed.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="settings-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-verification-title"
      >
        <button
          className="settings-dialog-close"
          type="button"
          aria-label="Close verification dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <h3 id="settings-verification-title">Verify this change</h3>
        <p>
          We sent a six-digit verification code to your admin email. It expires
          in 10 minutes.
        </p>
        <div className="settings-code-inputs">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              inputMode="numeric"
              maxLength={1}
              value={digit}
              aria-label={`Verification digit ${index + 1}`}
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, "").slice(-1);
                setCode((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? next : item,
                  ),
                );
                if (next) inputRefs.current[index + 1]?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && !code[index])
                  inputRefs.current[index - 1]?.focus();
                if (event.key === "Enter" && code.join("").length === 6)
                  submit();
              }}
            />
          ))}
        </div>
        {error && (
          <p className="setting-error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-dialog-actions">
          <Button variant="secondary" disabled={sending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={sending || code.join("").length !== 6}
            onClick={submit}
          >
            {sending ? "Checking..." : "Confirm and turn off"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IntegrationsSection({
  value,
  integrations,
  health,
  saving,
  onCommit,
  onTestEmail,
  onTestIntegration,
  onRefresh,
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState("");
  const [testResults, setTestResults] = useState({});
  const [verificationAction, setVerificationAction] = useState("");
  const testEmail = async () => {
    setTesting(true);
    setResult("");
    try {
      await onTestEmail();
      setResult("Test email sent to your admin email address.");
    } catch {
      setResult("Test email could not be sent. Try again.");
    } finally {
      setTesting(false);
    }
  };
  const testConfiguration = async (key) => {
    setTesting(key);
    setTestResults((current) => ({ ...current, [key]: "" }));
    try {
      await onTestIntegration(key);
      setTestResults((current) => ({
        ...current,
        [key]: "Configuration passed.",
      }));
    } catch (requestError) {
      setTestResults((current) => ({
        ...current,
        [key]:
          requestError.response?.data?.message || "Configuration test failed.",
      }));
    } finally {
      setTesting(false);
    }
  };
  async function changeIntegration(field, next) {
    await onCommit({ ...value, [field]: next });
  }
  const googleConfigured =
    health?.google?.configured ?? Boolean(integrations?.google);
  const recaptchaConfigured =
    health?.recaptcha?.configured ?? Boolean(integrations?.recaptcha);
  const calendarConfigured = health?.calendar?.configured ?? googleConfigured;
  const emailConfigured =
    health?.email?.configured ?? Boolean(integrations?.email);
  const googleRecord = health?.google || {};
  const recaptchaRecord = health?.recaptcha || {};
  const calendarRecord = health?.calendar || {};
  const emailRecord = health?.email || {};
  const lastChanged = (record) =>
    record?.updatedBy
      ? `Last changed by ${record.updatedBy.name} · ${new Date(record.updatedAt).toLocaleDateString()}`
      : "Never changed";
  const missingNote = (record) =>
    record?.missing?.length
      ? `Not configured: ${record.missing.map((name) => `\`${name}\``).join(", ")} is missing.`
      : "";
  return (
    <>
      <SettingsSection section={sectionMap.integrations}>
        <div className="settings-section-actions">
          <Button variant="secondary" onClick={onRefresh}>
            Re-check status
          </Button>
        </div>
        {(!googleConfigured || !recaptchaConfigured || !emailConfigured) && (
          <AttentionBanner
            href={!recaptchaConfigured ? "#recaptcha" : "#google-sign-in"}
          >
            {!recaptchaConfigured
              ? "reCAPTCHA isn't configured. Login and sign-up aren't protected against bots."
              : "Some integrations need attention before they can be enabled."}
          </AttentionBanner>
        )}
        <div
          className="integration-card-list"
          role="list"
          aria-label="Integrations"
        >
          <IntegrationCard
            id="google-sign-in"
            icon={<ShieldCheck size={22} />}
            title="Google sign-in"
            description="Let patients log in and sign up with their Google account."
            configured={calendarConfigured}
            checked={googleRecord.effectiveEnabled ?? value.googleAuthEnabled}
            onChange={(next) => changeIntegration("googleAuthEnabled", next)}
            loading={saving}
            meta={`${googleRecord.details?.clientIdMasked ? `Client ID ${googleRecord.details.clientIdMasked}` : "Client ID not set"} · ${lastChanged(googleRecord)}`}
            setupHint={!googleConfigured && missingNote(googleRecord)}
            footer={
              <>
                <GhostAction
                  icon={
                    testing === "google" ? (
                      <LoaderCircle className="settings-spin" size={14} />
                    ) : (
                      <Check size={14} />
                    )
                  }
                  onClick={() => testConfiguration("google")}
                >
                  {testing === "google" ? "Testing..." : "Test configuration"}
                </GhostAction>
                <GhostAction
                  icon={<Info size={14} />}
                  href="#integration-setup-guide"
                >
                  View setup guide
                </GhostAction>
                <GhostAction
                  icon={<Copy size={14} />}
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      googleRecord.details?.redirectUri || "",
                    )
                  }
                >
                  Copy redirect URI
                </GhostAction>
              </>
            }
          >
            {testResults.google && (
              <p className="integration-result" role="status">
                {testResults.google}
              </p>
            )}
          </IntegrationCard>
          <IntegrationCard
            id="recaptcha"
            icon={<ShieldCheck size={22} />}
            title="reCAPTCHA"
            description="Protect login, sign-up, and forgot password from bots."
            configured={recaptchaConfigured}
            checked={recaptchaRecord.effectiveEnabled ?? value.recaptchaEnabled}
            onChange={(next) => changeIntegration("recaptchaEnabled", next)}
            loading={saving}
            meta={`${recaptchaRecord.details?.siteKey ? "Site key configured" : "Site key not set"} · ${lastChanged(recaptchaRecord)}`}
            setupHint={!recaptchaConfigured && missingNote(recaptchaRecord)}
            footer={
              <>
                <GhostAction
                  icon={
                    testing === "recaptcha" ? (
                      <LoaderCircle className="settings-spin" size={14} />
                    ) : (
                      <Check size={14} />
                    )
                  }
                  onClick={() => testConfiguration("recaptcha")}
                >
                  {testing === "recaptcha"
                    ? "Testing..."
                    : "Test configuration"}
                </GhostAction>
                <GhostAction
                  icon={<Info size={14} />}
                  href="#integration-setup-guide"
                >
                  View setup guide
                </GhostAction>
              </>
            }
          >
            {testResults.recaptcha && (
              <p className="integration-result" role="status">
                {testResults.recaptcha}
              </p>
            )}
          </IntegrationCard>
          <IntegrationCard
            id="google-calendar"
            icon={<CalendarDays size={22} />}
            title="Google Calendar"
            description="Sync confirmed appointments to users' Google Calendars. Turning this off pauses syncing but keeps existing connections."
            configured={googleConfigured}
            checked={
              calendarRecord.effectiveEnabled ?? value.googleCalendarEnabled
            }
            onChange={(next) =>
              onCommit({ ...value, googleCalendarEnabled: next })
            }
            loading={saving}
            meta={`${calendarRecord.details?.redirectUri || "Calendar redirect URI not set"} · ${lastChanged(calendarRecord)}`}
            setupHint={!calendarConfigured && missingNote(calendarRecord)}
            footer={
              <>
                <GhostAction
                  icon={<Info size={14} />}
                  href="#integration-setup-guide"
                >
                  View setup guide
                </GhostAction>
                <GhostAction
                  icon={<ExternalLink size={14} />}
                  href="/README.md"
                >
                  Open README
                </GhostAction>
              </>
            }
          />
          <IntegrationCard
            id="email-provider"
            icon={<Mail size={22} />}
            title="Email provider"
            description="Sends password resets, invitations, and appointment emails."
            configured={emailConfigured && emailRecord.ok !== false}
            statusLabel={
              emailRecord.ok === true
                ? "Working"
                : emailRecord.ok === false
                  ? "Login rejected"
                  : undefined
            }
            meta={`${emailRecord.details?.senderAddress || "Sender address not set"} · ${lastChanged(emailRecord)}`}
            setupHint={!emailConfigured && missingNote(emailRecord)}
            footer={
              <>
                <GhostAction
                  icon={
                    testing ? (
                      <LoaderCircle className="settings-spin" size={14} />
                    ) : (
                      <Mail size={14} />
                    )
                  }
                  onClick={testEmail}
                >
                  {testing ? "Sending test email..." : "Send test email"}
                </GhostAction>
                <GhostAction
                  icon={<Info size={14} />}
                  href="#integration-setup-guide"
                >
                  View setup guide
                </GhostAction>
              </>
            }
          >
            {(result || emailRecord.lastTest) && (
              <p className="integration-result" role="status">
                {result ||
                  `${emailRecord.lastTest.ok ? "Last test passed" : "Last test failed"} · ${new Date(emailRecord.lastTest.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${emailRecord.lastTest.message}`}
              </p>
            )}
          </IntegrationCard>
        </div>
      </SettingsSection>
      {verificationAction && (
        <VerificationDialog
          action={verificationAction}
          onClose={() => setVerificationAction("")}
          onConfirmed={async (token) => {
            const field =
              verificationAction === "disableGoogleAuth"
                ? "googleAuthEnabled"
                : "recaptchaEnabled";
            await onCommit({ ...value, [field]: false }, token);
            setVerificationAction("");
          }}
        />
      )}
    </>
  );
}

function GeneralSection({ value, update }) {
  return (
    <SettingsSection section={sectionMap.general}>
      <SettingsCard
        title="Clinic profile"
        description="Shown in patient-facing pages and email templates."
      >
        <SettingRow label="Logo" helper="Use a clear clinic mark under 2 MB.">
          <div className="settings-logo-control">
            <span className="settings-logo-preview">
              <Store size={22} />
            </span>
            <Button variant="secondary">Replace</Button>
            <Button variant="secondary">Remove</Button>
          </div>
        </SettingRow>
        <SettingRow
          label="Clinic name"
          helper="The name patients see throughout the app."
        >
          <TextField
            value={value.clinicName}
            onChange={(next) => update("clinicName", next)}
          />
        </SettingRow>
        <SettingRow
          label="Phone"
          helper="The clinic number shown when booking is unavailable."
        >
          <TextField
            value={value.phone}
            onChange={(next) => update("phone", next)}
          />
        </SettingRow>
        <SettingRow label="Email" helper="The shared support email address.">
          <TextField
            type="email"
            value={value.email}
            onChange={(next) => update("email", next)}
          />
        </SettingRow>
        <SettingRow
          label="Address"
          helper="The clinic address used in contact details."
        >
          <TextField
            value={value.address}
            onChange={(next) => update("address", next)}
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard
        title="Regional"
        description="Fixed values used by the clinic."
        footer={
          <span className="settings-readonly">
            <Globe2 size={15} /> Fixed for this clinic
          </span>
        }
      >
        <SettingRow
          label="Timezone"
          helper="All appointment times use this timezone."
        >
          <span className="settings-readonly">{value.timezone}</span>
        </SettingRow>
        <SettingRow
          label="Currency"
          helper="Used for payment records and summaries."
        >
          <span className="settings-readonly">₱ {value.currency}</span>
        </SettingRow>
      </SettingsCard>
    </SettingsSection>
  );
}

function AuthSection({ value, update }) {
  return (
    <SettingsSection section={sectionMap.auth}>
      <SettingsCard
        title="Patient access"
        description="Control how patients create and verify accounts."
      >
        <SettingRow
          label="Patient self-registration"
          helper="Allow new patients to create their own account."
        >
          <Switch
            label="Patient self-registration"
            checked={value.patientRegistrationEnabled}
            onChange={(next) => update("patientRegistrationEnabled", next)}
          />
        </SettingRow>
        <SettingRow
          label="Require email verification"
          helper="Ask new patients to verify their email address."
        >
          <Switch
            label="Require email verification"
            checked={value.emailVerificationRequired}
            onChange={(next) => update("emailVerificationRequired", next)}
          />
        </SettingRow>
        <div className="settings-link-row">
          <KeyRound size={17} />
          <span>
            Sign-in providers and bot protection are managed in Integrations.
          </span>
          <Link to="/staff/admin/settings?section=integrations">
            Open Integrations
          </Link>
        </div>
      </SettingsCard>
      <SettingsCard
        title="Password and sessions"
        description="Set the minimum password and session protection rules."
      >
        <SettingRow
          label="Password minimum length"
          helper={`A valid password has at least ${value.passwordMinLength} characters.`}
        >
          <NumberStepper
            value={value.passwordMinLength}
            onChange={(next) => update("passwordMinLength", next)}
            min={8}
            max={32}
            unit="characters"
          />
        </SettingRow>
        <SettingRow
          label="Session timeout"
          helper="Staff accounts always use email and password."
        >
          <SelectField
            value={String(value.sessionTimeoutMinutes)}
            onChange={(next) => update("sessionTimeoutMinutes", Number(next))}
            ariaLabel="Session timeout"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="480">8 hours</option>
            <option value="1440">24 hours</option>
          </SelectField>
        </SettingRow>
        <SettingRow
          label="Max login attempts"
          helper="Attempts before temporary lockout."
        >
          <NumberStepper
            value={value.maxLoginAttempts}
            onChange={(next) => update("maxLoginAttempts", next)}
            min={3}
            max={10}
            unit="attempts"
          />
        </SettingRow>
        <SettingRow
          label="Lockout duration"
          helper="How long a locked account must wait."
        >
          <NumberStepper
            value={value.lockoutMinutes}
            onChange={(next) => update("lockoutMinutes", next)}
            min={1}
            max={1440}
            unit="minutes"
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard
        title="Terms"
        description="Require patients to accept the latest terms again when this changes."
      >
        <SettingRow
          label="Current version"
          helper="Bump this value to request re-acceptance."
        >
          <TextField
            value={value.termsVersion}
            onChange={(next) => update("termsVersion", next)}
          />
        </SettingRow>
        <Button variant="secondary">Require re-acceptance</Button>
      </SettingsCard>
      <InlineNote>
        Staff accounts always use email and password and can't be changed here.
      </InlineNote>
    </SettingsSection>
  );
}

function BookingSection({ value, update }) {
  const summary = `Patients can book between ${value.minNoticeHours} hours and ${value.maxAdvanceDays} days ahead, in ${value.slotIntervalMinutes}-minute slots.`;
  return (
    <SettingsSection section={sectionMap.booking}>
      <SettingsCard
        title="Online booking"
        description="Patients won't be able to request appointments when this is off."
      >
        <SettingRow
          label="Online booking"
          helper="The master switch for patient appointment requests."
        >
          <div className="settings-control-with-status">
            <Switch
              label="Online booking"
              checked={value.onlineBookingEnabled}
              onChange={(next) => update("onlineBookingEnabled", next)}
            />
            <Status
              configured={value.onlineBookingEnabled}
              label={value.onlineBookingEnabled ? "Enabled" : "Disabled"}
            />
          </div>
        </SettingRow>
      </SettingsCard>
      <div
        className={
          !value.onlineBookingEnabled
            ? "settings-dependent is-muted"
            : "settings-dependent"
        }
      >
        <SettingsCard title="Booking rules" description={summary}>
          <SettingRow
            label="Minimum notice"
            helper="How soon before a slot patients may book."
          >
            <NumberStepper
              value={value.minNoticeHours}
              onChange={(next) => update("minNoticeHours", next)}
              min={0}
              max={720}
              unit="hours"
            />
          </SettingRow>
          <SettingRow
            label="Maximum advance"
            helper="How far into the future booking is available."
          >
            <NumberStepper
              value={value.maxAdvanceDays}
              onChange={(next) => update("maxAdvanceDays", next)}
              min={1}
              max={365}
              unit="days"
            />
          </SettingRow>
          <SettingRow
            label="Slot interval"
            helper="The interval used to generate available slots."
          >
            <SelectField
              value={String(value.slotIntervalMinutes)}
              onChange={(next) => update("slotIntervalMinutes", Number(next))}
              ariaLabel="Slot interval"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </SelectField>
          </SettingRow>
          <SettingRow
            label="Pending request limit"
            helper="Maximum pending requests per patient."
          >
            <NumberStepper
              value={value.maxPendingRequestsPerPatient}
              onChange={(next) => update("maxPendingRequestsPerPatient", next)}
              min={1}
              max={20}
              unit="requests"
            />
          </SettingRow>
          <SettingRow
            label="Allow dependents"
            helper="Let patients book for linked dependents."
          >
            <Switch
              label="Allow dependents"
              checked={value.allowDependents}
              onChange={(next) => update("allowDependents", next)}
            />
          </SettingRow>
        </SettingsCard>
        <SettingsCard title="Changes and cancellations">
          <SettingRow
            label="Patients can cancel"
            helper="Allow patients to cancel from the portal."
          >
            <Switch
              label="Patients can cancel"
              checked={value.patientCanCancel}
              onChange={(next) => update("patientCanCancel", next)}
            />
          </SettingRow>
          <SettingRow
            label="Cancellation cutoff"
            helper="Minimum hours before an appointment."
          >
            <NumberStepper
              value={value.patientCancelCutoffHours}
              onChange={(next) => update("patientCancelCutoffHours", next)}
              min={0}
              max={720}
              unit="hours"
            />
          </SettingRow>
          <SettingRow
            label="Reschedule cutoff"
            helper="Minimum hours before an appointment."
          >
            <NumberStepper
              value={value.rescheduleCutoffHours}
              onChange={(next) => update("rescheduleCutoffHours", next)}
              min={0}
              max={720}
              unit="hours"
            />
          </SettingRow>
        </SettingsCard>
      </div>
    </SettingsSection>
  );
}

function ScheduleSection({ value, update }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <SettingsSection section={sectionMap.schedule}>
      <SettingsCard
        title="Opening hours"
        description="Choose open days and the regular clinic hours."
        action={<Button variant="secondary">Copy to all days</Button>}
      >
        {days.map((day) => (
          <SettingRow
            key={day}
            label={day}
            helper={
              value.openDays?.includes(day)
                ? "Open for appointments"
                : "Closed for appointments"
            }
          >
            <div className="settings-day-control">
              <Switch
                label={`${day} open`}
                checked={value.openDays?.includes(day)}
                onChange={(next) =>
                  update(
                    "openDays",
                    next
                      ? [...(value.openDays || []), day]
                      : (value.openDays || []).filter((item) => item !== day),
                  )
                }
              />
              <TextField
                value={value.openHours?.start || "08:00"}
                onChange={(next) =>
                  update("openHours", { ...value.openHours, start: next })
                }
              />
              <span>to</span>
              <TextField
                value={value.openHours?.end || "17:00"}
                onChange={(next) =>
                  update("openHours", { ...value.openHours, end: next })
                }
              />
            </div>
          </SettingRow>
        ))}
      </SettingsCard>
      <SettingsCard
        title="Closed dates"
        description="Holidays and exceptional clinic closures."
        action={<Button variant="secondary">Add closure</Button>}
      >
        <DashboardEmptyState
          icon={<CalendarDays size={20} />}
          title="No closures scheduled"
          message="Add a closure when the clinic will be unavailable."
        />
      </SettingsCard>
    </SettingsSection>
  );
}

function NotificationsSection({ value, update, onTestEmail }) {
  return (
    <SettingsSection section={sectionMap.notifications}>
      <SettingsCard
        title="Channels"
        description="Choose where clinic messages are delivered."
      >
        <SettingRow
          label="Email notifications"
          helper="Send appointment and account emails."
        >
          <Switch
            label="Email notifications"
            checked={value.emailEnabled}
            onChange={(next) => update("emailEnabled", next)}
          />
        </SettingRow>
        <SettingRow
          label="In-app notifications"
          helper="Show updates in the patient and staff portals."
        >
          <Switch
            label="In-app notifications"
            checked={value.inAppEnabled}
            onChange={(next) => update("inAppEnabled", next)}
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard
        title="Reminders"
        description="Choose when appointment reminders are sent."
      >
        <SettingRow
          label="Send reminders"
          helper="Reminder notifications can be changed without affecting bookings."
        >
          <Switch
            label="Send reminders"
            checked={value.remindersEnabled}
            onChange={(next) => update("remindersEnabled", next)}
          />
        </SettingRow>
        <SettingRow
          label="Lead time"
          helper="At least one reminder time is required."
        >
          <ChipToggleGroup
            options={["24h", "12h", "2h", "1h"]}
            value={(value.reminderLeadHours || []).map((hour) => `${hour}h`)}
            onChange={(next) =>
              update(
                "reminderLeadHours",
                next.map((hour) => Number.parseInt(hour, 10)),
              )
            }
          />
        </SettingRow>
        <SettingRow label="Sender name" helper="Shown in notification emails.">
          <TextField
            value={value.senderName}
            onChange={(next) => update("senderName", next)}
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard title="Test">
        <Button variant="secondary" onClick={onTestEmail}>
          <Mail size={16} /> Send test email
        </Button>
      </SettingsCard>
    </SettingsSection>
  );
}

function PaymentsSection({ value, update }) {
  const methods = ["Cash", "GCash", "Card", "Other"];
  return (
    <SettingsSection section={sectionMap.payments}>
      <SettingsCard
        title="Payment methods"
        description="At least one payment method must remain enabled."
      >
        <SettingRow
          label="Enabled methods"
          helper="These methods appear when staff record a payment."
        >
          <ChipToggleGroup
            options={methods}
            value={value.enabledMethods || []}
            onChange={(next) => update("enabledMethods", next)}
          />
        </SettingRow>
        <SettingRow
          label="Reference for non-cash"
          helper="Require a reference number for GCash, card, or other payments."
        >
          <Switch
            label="Reference for non-cash"
            checked={value.requireReferenceForNonCash}
            onChange={(next) => update("requireReferenceForNonCash", next)}
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard title="Currency">
        <SettingRow label="Clinic currency" helper="Fixed for this clinic.">
          <span className="settings-readonly">₱ PHP</span>
        </SettingRow>
      </SettingsCard>
    </SettingsSection>
  );
}

function MaintenanceSection({ value, update }) {
  return (
    <SettingsSection section={sectionMap.system}>
      <SettingsCard
        className="settings-danger-card"
        title="Maintenance mode"
        description="Patients see the message while staff keep full access."
      >
        <SettingRow
          label="Maintenance mode"
          helper="Use this while the clinic app is unavailable to patients."
        >
          <div className="settings-control-with-status">
            <Switch
              label="Maintenance mode"
              checked={value.maintenanceMode}
              onChange={(next) => update("maintenanceMode", next)}
            />
            <Status
              configured={value.maintenanceMode}
              label={value.maintenanceMode ? "Enabled" : "Disabled"}
            />
          </div>
        </SettingRow>
        <SettingRow
          label="Patient message"
          helper="Shown on the patient maintenance screen."
        >
          <TextField
            value={value.maintenanceMessage}
            onChange={(next) => update("maintenanceMessage", next)}
          />
        </SettingRow>
        <InlineNote type="danger">
          Patients can't book or log in during maintenance. Staff can still
          access the portal.
        </InlineNote>
        <div className="settings-preview">
          <span>Patient preview</span>
          <strong>{value.maintenanceMessage}</strong>
        </div>
      </SettingsCard>
      <SettingsCard
        title="Announcement banner"
        description="Show a short message at the top of the patient portal."
      >
        <SettingRow
          label="Announcement enabled"
          helper="Patients see this banner until it expires."
        >
          <Switch
            label="Announcement enabled"
            checked={value.announcement?.enabled}
            onChange={(next) =>
              update("announcement", { ...value.announcement, enabled: next })
            }
          />
        </SettingRow>
        <SettingRow
          label="Message"
          helper="Keep the message concise and useful."
        >
          <TextField
            value={value.announcement?.message}
            onChange={(next) =>
              update("announcement", { ...value.announcement, message: next })
            }
          />
        </SettingRow>
        <SettingRow label="Type" helper="Choose the tone of the announcement.">
          <SelectField
            value={value.announcement?.type || "info"}
            onChange={(next) =>
              update("announcement", { ...value.announcement, type: next })
            }
            ariaLabel="Announcement type"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
          </SelectField>
        </SettingRow>
      </SettingsCard>
    </SettingsSection>
  );
}

function AuditSection() {
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    getSettingsAudit()
      .then((response) => setEntries(response.data.entries || []))
      .catch(() => setEntries([]));
  }, []);
  return (
    <SettingsSection section={sectionMap.audit}>
      <SettingsCard
        title="Change history"
        description="Times are shown in Asia/Manila."
      >
        <div className="settings-audit-toolbar">
          <TextField placeholder="Search changes" />
          <SelectField
            value="all"
            onChange={() => {}}
            ariaLabel="Audit section"
          >
            <option value="all">All sections</option>
            {sections.map((section) => (
              <option key={section.key} value={section.key}>
                {section.title}
              </option>
            ))}
          </SelectField>
          <Button variant="secondary">
            <Archive size={15} /> Export
          </Button>
        </div>
        {!entries ? (
          <SectionSkeleton />
        ) : !entries.length ? (
          <DashboardEmptyState
            icon={<FileClock size={20} />}
            title="No changes recorded yet"
            message="Settings changes will appear here with the admin, time, and before-and-after values."
          />
        ) : (
          <div className="settings-audit-table">
            <div className="settings-audit-head">
              <span>Time</span>
              <span>Admin</span>
              <span>Setting</span>
              <span>Change</span>
            </div>
            {entries.map((entry) => (
              <div className="settings-audit-row" key={entry._id}>
                <span>
                  {new Date(entry.createdAt).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </span>
                <span>
                  <UserRound size={14} /> {entry.admin?.firstname || "Admin"}{" "}
                  {entry.admin?.lastname || ""}
                </span>
                <span>
                  {sectionMap[entry.section]?.title || entry.section} ·{" "}
                  {entry.field}
                </span>
                <span>
                  {String(entry.oldValue)} → {String(entry.newValue)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}

function SearchBox({ value, onChange, results, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="settings-search">
      <Search size={17} aria-hidden="true" />
      <input
        aria-label="Search settings"
        placeholder="Search settings"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && results[0]) {
            onSelect(results[0]);
            setOpen(false);
          }
        }}
      />
      {open && value && (
        <div className="settings-search-results" role="listbox">
          {results.length ? (
            results.map((result) => (
              <button
                type="button"
                key={result.id}
                onClick={() => {
                  onSelect(result);
                  setOpen(false);
                }}
              >
                <strong>{result.label}</strong>
                <span>{result.section}</span>
              </button>
            ))
          ) : (
            <p>No settings match “{value}”</p>
          )}
        </div>
      )}
    </div>
  );
}

function SectionSkeletonPage() {
  return <SectionSkeleton />;
}

export default function SettingsPage() {
  const [params] = useSearchParams();
  const section = sectionMap[params.get("section") || "general"]
    ? params.get("section") || "general"
    : "general";
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [integrationHealth, setIntegrationHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verificationTokens, setVerificationTokens] = useState({});
  const [search, setSearch] = useState("");
  const sectionRef = useRef(null);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings?.[section]),
    [draft, settings, section],
  );
  const results = useMemo(
    () =>
      sections
        .flatMap((item) => [
          { ...item, id: item.key },
          {
            id: `${item.key}-helper`,
            label: item.description,
            section: item.title,
            key: item.key,
          },
        ])
        .filter((item) =>
          `${item.label} ${item.description || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 8),
    [search],
  );
  useEffect(() => {
    let active = true;
    const request = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      Promise.allSettled([
        getAdminSettings(),
        getIntegrationHealth(),
        getIntegrations(),
      ])
        .then(([settingsResult, healthResult, integrationResult]) => {
          if (!active) return;
          if (settingsResult.status === "rejected") throw settingsResult.reason;
          const response = settingsResult.value;
          setSettings(response.data.settings);
          setDraft(response.data.settings[section]);
          setIntegrations(response.data.integrations);
          const records =
            integrationResult.status === "fulfilled"
              ? integrationResult.value.data
              : [];
          const recordMap = Object.fromEntries(
            records.map((item) => [item.key, item]),
          );
          const emailHealth =
            healthResult.status === "fulfilled"
              ? healthResult.value.data.email
              : null;
          setIntegrationHealth(
            healthResult.status === "fulfilled"
              ? healthResult.value.data
              : {
                  google: recordMap.googleAuth,
                  recaptcha: recordMap.recaptcha,
                  calendar: recordMap.googleCalendar,
                  email: { ...recordMap.email, ...emailHealth },
                },
          );
        })
        .catch(() => active && setError(true))
        .finally(() => active && setLoading(false));
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(request);
    };
  }, [section]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "/" && event.target.tagName !== "INPUT") {
        event.preventDefault();
        document.querySelector(".settings-search input")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const update = (field, value) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const payload =
        section === "integrations" && verificationTokens.googleAuthEnabled
          ? {
              ...draft,
              verificationToken: verificationTokens.googleAuthEnabled,
            }
          : section === "integrations" && verificationTokens.recaptchaEnabled
            ? {
                ...draft,
                verificationToken: verificationTokens.recaptchaEnabled,
              }
            : draft;
      const response = await updateSettingsSection(section, payload);
      setSettings((current) => ({
        ...current,
        [section]: response.data.section,
      }));
      setDraft(response.data.section);
      setVerificationTokens({});
      showSuccess(`${sectionMap[section].title} settings updated`);
    } catch (requestError) {
      showError(
        requestError.response?.data?.message || "Settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const commitIntegration = async (nextDraft, verificationToken) => {
    setSaving(true);
    try {
      const fieldMap = {
        googleAuthEnabled: "googleAuth",
        recaptchaEnabled: "recaptcha",
        googleCalendarEnabled: "googleCalendar",
      };
      const field = Object.keys(fieldMap).find(
        (name) => nextDraft[name] !== settings.integrations[name],
      );
      if (!field) return;
      const response = await updateIntegration(fieldMap[field], {
        enabled: nextDraft[field],
        ...(verificationToken ? { verificationToken } : {}),
      });
      setSettings((current) => ({
        ...current,
        integrations: {
          ...current.integrations,
          [field]: response.data.enabled,
        },
      }));
      setDraft((current) => ({ ...current, [field]: response.data.enabled }));
      setIntegrationHealth((current) => ({
        ...current,
        [fieldMap[field] === "googleCalendar" ? "calendar" : fieldMap[field]]:
          response.data,
      }));
      setVerificationTokens({});
      showSuccess("Integration settings updated");
    } catch (requestError) {
      showError(
        requestError.response?.data?.message ||
          "Integration settings could not be saved.",
      );
      throw requestError;
    } finally {
      setSaving(false);
    }
  };
  const refreshIntegrations = async () => {
    const [integrationResult, healthResult] = await Promise.all([
      getIntegrations(),
      getIntegrationHealth(),
    ]);
    const records = Object.fromEntries(
      integrationResult.data.map((item) => [item.key, item]),
    );
    setIntegrationHealth({
      google: records.googleAuth,
      recaptcha: records.recaptcha,
      calendar: records.googleCalendar,
      email: { ...records.email, ...healthResult.data.email },
    });
  };
  const selectSearchResult = (result) => {
    window.history.pushState(
      {},
      "",
      `/staff/admin/settings?section=${result.key}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
    setTimeout(
      () =>
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      0,
    );
  };
  const renderSection = () => {
    if (loading) return <SectionSkeletonPage />;
    if (error || !draft)
      return (
        <SettingsCard>
          <DashboardEmptyState
            icon={<AlertTriangle size={20} />}
            title="We couldn't load these settings"
            message="Try again to load the latest clinic settings."
            action={
              <Button onClick={() => window.location.reload()}>
                Try again
              </Button>
            }
          />
        </SettingsCard>
      );
    if (section === "general")
      return <GeneralSection value={draft} update={update} />;
    if (section === "auth")
      return <AuthSection value={draft} update={update} />;
    if (section === "booking")
      return <BookingSection value={draft} update={update} />;
    if (section === "schedule")
      return <ScheduleSection value={draft} update={update} />;
    if (section === "notifications")
      return (
        <NotificationsSection
          value={draft}
          update={update}
          onTestEmail={() =>
            sendSettingsTestEmail()
              .then((response) => {
                showSuccess(response.data?.message || "Test email sent");
              })
              .catch((requestError) => {
                showError(
                  requestError.response?.data?.message ||
                    "The email provider could not send the test email.",
                );
                throw requestError;
              })
          }
        />
      );
    if (section === "payments")
      return <PaymentsSection value={draft} update={update} />;
    if (section === "integrations")
      return (
        <IntegrationsSection
          value={draft}
          integrations={integrations}
          health={integrationHealth}
          saving={saving}
          onCommit={commitIntegration}
          onRefresh={refreshIntegrations}
          onTestEmail={() =>
            sendSettingsTestEmail()
              .then((response) =>
                showSuccess(response.data?.message || "Test email sent"),
              )
              .catch((requestError) => {
                showError(
                  requestError.response?.data?.message ||
                    "The email provider could not send the test email.",
                );
                throw requestError;
              })
          }
          onTestIntegration={async (key) => {
            try {
              await testIntegration(key);
              showSuccess(
                `${key === "google" ? "Google sign-in" : "reCAPTCHA"} configuration passed`,
              );
            } catch (requestError) {
              showError(
                requestError.response?.data?.message ||
                  "Integration test failed.",
              );
              throw requestError;
            }
          }}
        />
      );
    if (section === "system")
      return <MaintenanceSection value={draft} update={update} />;
    return <AuditSection />;
  };
  return (
    <main className="staff-page settings-page">
      <StaffPageHeader
        eyebrow="SYSTEM"
        title="Settings"
        description="Control how the clinic app behaves."
        action={
          <SearchBox
            value={search}
            onChange={setSearch}
            results={results}
            onSelect={selectSearchResult}
          />
        }
      />
      <div className="settings-layout">
        <nav className="settings-sections" aria-label="Settings sections">
          {["Clinic", "Access", "Operations"].map((group) => (
            <div className="settings-nav-group" key={group}>
              <span className="settings-nav-label">{group}</span>
              {sections
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  const needsAttention =
                    item.key === "integrations" &&
                    integrations &&
                    (!integrations.google ||
                      !integrations.recaptcha ||
                      !integrations.email);
                  return (
                    <Link
                      className={section === item.key ? "is-active" : ""}
                      key={item.key}
                      to={
                        item.key === "general"
                          ? "/staff/admin/settings"
                          : `/staff/admin/settings?section=${item.key}`
                      }
                      aria-current={section === item.key ? "page" : undefined}
                    >
                      <Icon size={16} aria-hidden="true" />
                      <span>{item.label}</span>
                      {needsAttention && (
                        <i
                          className="settings-nav-attention"
                          aria-label="Needs attention"
                        />
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <section className="settings-content" ref={sectionRef}>
          {renderSection()}
          {!loading && !error && section !== "audit" && (
            <StickySaveBar
              dirty={dirty}
              saving={saving}
              onSave={save}
              onDiscard={() => setDraft(settings[section])}
            />
          )}
        </section>
      </div>
    </main>
  );
}
