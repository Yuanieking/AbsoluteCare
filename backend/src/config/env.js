import { config } from "dotenv";

config();

const getEnv = (key, defaultValue = null) => {
  const value = process.env[key] || defaultValue;

  if (value === undefined) {
    throw new Error(`No value found: ${key}`);
  }

  return value;
};

export const PORT = getEnv("PORT", 8080);
export const MONGO_URI = getEnv(
  "MONGO_URI",
  "mongodb://localhost:27017/absolutecare",
);
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
  "http://localhost:5000/auth/google/callback",
);
export const GOOGLE_CALENDAR_REDIRECT_URI = getEnv(
  "GOOGLE_CALENDAR_REDIRECT_URI",
  "http://localhost:5000/integrations/google-calendar/callback",
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
export const MAIL_FROM = getEnv(
  "MAIL_FROM",
  GMAIL_USER
    ? `AbsoluteCare Therapy Center <${GMAIL_USER}>`
    : "AbsoluteCare Therapy Center <no-reply@absolutecare.local>",
);
