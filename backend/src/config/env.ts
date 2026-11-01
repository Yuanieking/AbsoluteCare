import { config } from "dotenv";
import { ENV_PATH } from "./paths.js";

config({ path: ENV_PATH });

const getEnv = (key: string, defaultValue: string): string => {
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
function ensureDatabaseName(uri: string, fallback: string): string {
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
export const CLINIC_ADDRESS = getEnv(
  "CLINIC_ADDRESS",
  "AbsoluteCare Physical Therapy",
);
export const FRONTEND_URL = getEnv("FRONTEND_URL", "http://localhost:5173");
export const ASSETS_BASE_URL = getEnv("ASSETS_BASE_URL", "");
export const JWT_SECRET = getEnv("JWT_SECRET", "absolutecare-secret-key");
export const SMTP_HOST = getEnv("SMTP_HOST", "smtp.gmail.com");
export const SMTP_PORT = getEnv("SMTP_PORT", "465");
export const SMTP_USER = getEnv("SMTP_USER", "");
export const SMTP_PASSWORD = getEnv("SMTP_PASSWORD", "");
export const GMAIL_USER = getEnv("GMAIL_USER", SMTP_USER);
export const GMAIL_APP_PASSWORD = getEnv("GMAIL_APP_PASSWORD", SMTP_PASSWORD);
export const GMAIL_CLIENT_ID = getEnv("GMAIL_CLIENT_ID", "");
export const GMAIL_CLIENT_SECRET = getEnv("GMAIL_CLIENT_SECRET", "");
export const GMAIL_REFRESH_TOKEN = getEnv("GMAIL_REFRESH_TOKEN", "");
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
  GMAIL_USER
    ? `AbsoluteCare Therapy Center <${GMAIL_USER}>`
    : "AbsoluteCare Therapy Center <no-reply@absolutecare.local>",
);
