import { config } from "dotenv";
import { ENV_PATH } from "./paths.js";

config({ path: ENV_PATH });

const getEnv = (key, defaultValue) => {
  const value = process.env[key] || defaultValue;

  if (value === undefined) {
    throw new Error(`No value found: ${key}`);
  }

  return value;
};

const MONGO_SCHEME = /^mongodb(\+srv)?:\/\//i;

/**
 * Mongo falls back to the "test" database when a URI carries no path, which
 * silently splits the API from the seeded data. Name the database instead.
 */
function ensureDatabaseName(uri, fallback) {
  const scheme = MONGO_SCHEME.exec(uri);
  if (!scheme) return uri;
  const rest = uri.slice(scheme[0].length);
  const queryStart = rest.search(/[?#]/);
  const address = queryStart === -1 ? rest : rest.slice(0, queryStart);
  const query = queryStart === -1 ? "" : rest.slice(queryStart);
  const slash = address.indexOf("/");
  if (slash !== -1 && address.slice(slash + 1)) return uri;
  const authority = slash === -1 ? address : address.slice(0, slash);
  return `${scheme[0]}${authority}/${fallback}${query}`;
}

export const PORT = Number(getEnv("PORT", "8080"));
export const MONGO_URI = ensureDatabaseName(
  getEnv("MONGO_URI", "mongodb://localhost:27017/absolutecare"),
  "absolutecare",
);
export const API_BASE_URL = getEnv("API_BASE_URL", `http://localhost:${PORT}`);
export const RECAPTCHA_SITE_KEY = getEnv("RECAPTCHA_SITE_KEY", "");
export const RECAPTCHA_SECRET_KEY = getEnv("RECAPTCHA_SECRET_KEY", "");
export const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID", "");
export const GOOGLE_SECRET_KEY = getEnv("GOOGLE_SECRET_KEY", "");
export const GOOGLE_CLIENT_SECRET = getEnv(
  "GOOGLE_CLIENT_SECRET",
  GOOGLE_SECRET_KEY,
);
export const GOOGLE_REDIRECT_URI = getEnv(
  "GOOGLE_REDIRECT_URI",
  `${API_BASE_URL}/auth/google/callback`,
);
export const GOOGLE_CALENDAR_REDIRECT_URI = getEnv(
  "GOOGLE_CALENDAR_REDIRECT_URI",
  `${API_BASE_URL}/integrations/google-calendar/callback`,
);
export const GOOGLE_CALENDAR_ENCRYPTION_KEY = getEnv(
  "GOOGLE_CALENDAR_ENCRYPTION_KEY",
  "absolutecare-calendar-development-key",
);
export const GOOGLE_DRIVE_REDIRECT_URI = getEnv(
  "GOOGLE_DRIVE_REDIRECT_URI",
  `${API_BASE_URL}/integrations/google-drive/callback`,
);
export const GOOGLE_DRIVE_ROOT_FOLDER_ID = getEnv(
  "GOOGLE_DRIVE_ROOT_FOLDER_ID",
  "",
);
export const CLINIC_ADDRESS = getEnv(
  "CLINIC_ADDRESS",
  "AbsoluteCare Physical Therapy",
);
export const FRONTEND_URL = getEnv("FRONTEND_URL", "http://localhost:5173");
export const ASSETS_BASE_URL = getEnv("ASSETS_BASE_URL", "");
export const JWT_SECRET = getEnv("JWT_SECRET", "absolutecare-secret-key");
export const BREVO_API_KEY = getEnv("BREVO_API_KEY", "");
export const CREDENTIAL_ENCRYPTION_KEY = getEnv(
  "CREDENTIAL_ENCRYPTION_KEY",
  "",
);
export const ALLOW_SELF_RESTART =
  getEnv("ALLOW_SELF_RESTART", "false") === "true";
export const INTEGRATION_VALIDATION = getEnv("INTEGRATION_VALIDATION", "on");
export const ENV_WRITE = getEnv("ENV_WRITE", "on");
export const ADMIN_EMAILS = getEnv("ADMIN_EMAILS", "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
export const MAIL_FROM = getEnv(
  "MAIL_FROM",
  "AbsoluteCare Therapy Center <no-reply@absolutecare.local>",
);
// Superuser second factor for sensitive integration changes: the admin enters
// SU_PASS, then a six-digit code sent to SU_EMAIL. Both must be set.
export const SU_EMAIL = getEnv("SU_EMAIL", "").trim().toLowerCase();
// SU_PASSWORD is accepted as an alias of SU_PASS.
export const SU_PASS = getEnv("SU_PASS", getEnv("SU_PASSWORD", ""));
// Where "Send test email" delivers. Blank falls back to the signed-in admin.
export const TEST_EMAIL_RECIPIENT = getEnv("TEST_EMAIL_RECIPIENT", "").trim();
