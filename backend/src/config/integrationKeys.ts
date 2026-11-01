export const MASK_DOTS = "••••••••";

export type IntegrationKeyKind = "identifier" | "secret" | "public" | "config";

export interface IntegrationGroup {
  id: string;
  apiKey: string;
  title: string;
  purpose: string;
  helpUrl: string;
  redirectPath?: string;
}

export interface IntegrationKeyDefinition {
  key: string;
  group: string;
  kind: IntegrationKeyKind;
  label: string;
  required: boolean;
  loadBearing?: boolean;
  sharedWith?: string;
  helpUrl: string | null;
  helper?: string;
  validate?: (value: string) => string | null;
  warn?: (value: string) => string | null;
}

export const PLACEHOLDER_VALUES = new Set([
  "your-client-id",
  "changeme",
  "xxx",
  "your-secret",
  "replace-me",
  "replace-with",
]);

export const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    id: "google",
    apiKey: "googleAuth",
    title: "Google sign-in",
    purpose: "Lets patients sign in and sign up with their Google account.",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    redirectPath: "/auth/google/callback",
  },
  {
    id: "recaptcha",
    apiKey: "recaptcha",
    title: "reCAPTCHA",
    purpose: "Blocks automated sign-ups, logins, and password resets.",
    helpUrl: "https://www.google.com/recaptcha/admin",
  },
  {
    id: "googleCalendar",
    apiKey: "googleCalendar",
    title: "Google Calendar",
    purpose:
      "Adds confirmed sessions to the patient's and therapist's own calendars.",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    redirectPath: "/integrations/google-calendar/callback",
  },
  {
    id: "email",
    apiKey: "email",
    title: "Email provider",
    purpose: "Sends password resets, invitations, and appointment emails.",
    helpUrl: "https://support.google.com/accounts/answer/185833",
  },
];

const clean = (value: string): string =>
  typeof value === "string" ? value.trim() : "";

const CLIENT_ID = /^\d{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAIL_FROM =
  /^(?:[^<>]+<\s*[^\s@]+@[^\s@]+\.[^\s@]+>|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

function absoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const INTEGRATION_KEYS: IntegrationKeyDefinition[] = [
  {
    key: "GOOGLE_CLIENT_ID",
    group: "google",
    kind: "identifier",
    label: "Client ID",
    required: true,
    loadBearing: true,
    sharedWith: "email",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helper: "Ends in .apps.googleusercontent.com.",
    warn: (value) =>
      CLIENT_ID.test(clean(value))
        ? null
        : "This doesn't match the usual Google client ID format.",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    group: "google",
    kind: "secret",
    label: "Client secret",
    required: true,
    loadBearing: true,
    sharedWith: "email",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helper: "Starts with GOCSPX-.",
    validate: (value) =>
      clean(value).length < 10 ? "That secret looks too short." : null,
  },
  {
    key: "GOOGLE_SECRET_KEY",
    group: "google",
    kind: "secret",
    label: "Legacy secret alias",
    required: false,
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helper:
      "Older installs read GOOGLE_SECRET_KEY. Saving it also updates the client secret.",
  },
  {
    key: "RECAPTCHA_SITE_KEY",
    group: "recaptcha",
    kind: "public",
    label: "Site key",
    required: true,
    helpUrl: "https://www.google.com/recaptcha/admin",
    helper: "Public. Browsers receive this value, so it is shown in full.",
  },
  {
    key: "RECAPTCHA_SECRET_KEY",
    group: "recaptcha",
    kind: "secret",
    label: "Secret key",
    required: true,
    helpUrl: "https://www.google.com/recaptcha/admin",
    helper: "Server-side only.",
  },
  {
    key: "GOOGLE_CALENDAR_REDIRECT_URI",
    group: "googleCalendar",
    kind: "config",
    label: "Redirect URI",
    required: true,
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helper: "Register this exact value in the Google Cloud console.",
    validate: (value) =>
      absoluteUrl(clean(value))
        ? null
        : "Enter the full http:// or https:// callback address.",
  },
  {
    key: "GOOGLE_CALENDAR_ENCRYPTION_KEY",
    group: "googleCalendar",
    kind: "secret",
    label: "Encryption key",
    required: true,
    loadBearing: true,
    helpUrl: null,
    helper:
      "Encrypts stored calendar refresh tokens. Changing it disconnects every connected calendar.",
    validate: (value) =>
      clean(value).length < 16
        ? "Use at least 16 characters of random text."
        : null,
  },
  {
    key: "SMTP_HOST",
    group: "email",
    kind: "config",
    label: "SMTP host",
    required: false,
    helpUrl: "https://support.google.com/accounts/answer/185833",
    helper: "smtp.gmail.com for Gmail.",
  },
  {
    key: "SMTP_PORT",
    group: "email",
    kind: "config",
    label: "SMTP port",
    required: false,
    helpUrl: null,
    helper: "465 for secure SMTP, 587 for STARTTLS.",
    validate: (value) => {
      const port = Number(clean(value));
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        return "Enter a port between 1 and 65535.";
      return null;
    },
  },
  {
    key: "SMTP_SECURE",
    group: "email",
    kind: "config",
    label: "Secure connection",
    required: false,
    helpUrl: null,
    helper: "true or false. Leave blank to derive it from the port.",
    validate: (value) =>
      ["true", "false"].includes(clean(value).toLowerCase())
        ? null
        : "Enter true or false.",
  },
  {
    key: "SMTP_USER",
    group: "email",
    kind: "identifier",
    label: "SMTP user",
    required: false,
    helpUrl: null,
    helper: "Usually the full email address of the sending account.",
    validate: (value) =>
      EMAIL.test(clean(value)) ? null : "Enter a valid email address.",
  },
  {
    key: "SMTP_PASS",
    group: "email",
    kind: "secret",
    label: "SMTP password",
    required: false,
    helpUrl: "https://support.google.com/accounts/answer/185833",
    helper:
      "Gmail requires a 16-character App Password, not the account password.",
    validate: (value) =>
      clean(value).length < 8 ? "That password looks too short." : null,
  },
  {
    key: "MAIL_FROM",
    group: "email",
    kind: "public",
    label: "Sender address",
    required: true,
    helpUrl: null,
    helper: "Either name@clinic.com or AbsoluteCare <name@clinic.com>.",
    validate: (value) =>
      MAIL_FROM.test(clean(value))
        ? null
        : "Use name@clinic.com or AbsoluteCare <name@clinic.com>.",
  },
  {
    key: "GMAIL_USER",
    group: "email",
    kind: "identifier",
    label: "Gmail user (OAuth)",
    required: false,
    helpUrl: null,
    helper: "Only needed for the Gmail OAuth path.",
    validate: (value) =>
      EMAIL.test(clean(value)) ? null : "Enter a valid email address.",
  },
  {
    key: "GMAIL_CLIENT_ID",
    group: "email",
    kind: "identifier",
    label: "Gmail client ID",
    required: false,
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helper: "Only needed for the Gmail OAuth path.",
  },
  {
    key: "GMAIL_CLIENT_SECRET",
    group: "email",
    kind: "secret",
    label: "Gmail client secret",
    required: false,
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helper: "Only needed for the Gmail OAuth path.",
  },
  {
    key: "GMAIL_APP_PASSWORD",
    group: "email",
    kind: "secret",
    label: "Gmail app password",
    required: false,
    helpUrl: "https://support.google.com/accounts/answer/185833",
    helper: "Only needed for the Gmail OAuth path.",
  },
  {
    key: "GMAIL_REFRESH_TOKEN",
    group: "email",
    kind: "secret",
    label: "Gmail refresh token",
    required: false,
    helpUrl: null,
    helper: "Issued by Google. Reconnect the account if mail stops sending.",
  },
];

export const MANAGED_KEYS = new Set(INTEGRATION_KEYS.map((entry) => entry.key));

export const LOAD_BEARING_KEYS = new Set(
  INTEGRATION_KEYS.filter((entry) => entry.loadBearing).map(
    (entry) => entry.key,
  ),
);

export function groupById(id: string): IntegrationGroup | null {
  return INTEGRATION_GROUPS.find((group) => group.id === id) || null;
}

export function groupKeys(id: string): IntegrationKeyDefinition[] {
  return INTEGRATION_KEYS.filter((entry) => entry.group === id);
}

export function keyDefinition(key: string): IntegrationKeyDefinition | null {
  return INTEGRATION_KEYS.find((entry) => entry.key === key) || null;
}

export function isPlaceholder(value: string): boolean {
  const normalized = clean(value).toLowerCase();
  return !normalized || PLACEHOLDER_VALUES.has(normalized);
}

export function maskValue(value: string, kind: string): string {
  const trimmed = clean(value);
  if (isPlaceholder(trimmed)) return "Not set";
  if (kind === "public" || kind === "config") return trimmed;
  const visible = trimmed.length < 10 ? 2 : 5;
  return `${trimmed.slice(0, visible)}${MASK_DOTS}`;
}

export function validateValue(
  entry: IntegrationKeyDefinition,
  value: string,
): string | null {
  const trimmed = clean(value);
  if (!trimmed) return "Enter a value.";
  if (trimmed.length > 4096)
    return "That value is too long (4096 characters max).";
  if (/[\r\n]/.test(value)) return "Values cannot contain line breaks.";
  return entry.validate?.(trimmed) ?? null;
}

export function warningFor(
  entry: IntegrationKeyDefinition,
  value: string,
): string | null {
  return entry.warn?.(value) ?? null;
}
