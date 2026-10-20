import {
  GMAIL_APP_PASSWORD,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER,
  GOOGLE_CALENDAR_REDIRECT_URI,
  GOOGLE_CLIENT_ID,
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_USER,
} from "./env.js";

const PLACEHOLDER_VALUES = new Set([
  "your-client-id",
  "changeme",
  "xxx",
  "your-secret",
  "replace-me",
  "replace-with",
]);

function valueIsConfigured(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !PLACEHOLDER_VALUES.has(normalized);
}

function missingVariables(values) {
  return Object.entries(values)
    .filter(([, value]) => !valueIsConfigured(value))
    .map(([name]) => name);
}

function maskClientId(value) {
  if (!valueIsConfigured(value)) return null;
  const trimmed = value.trim();
  return trimmed.length > 12 ? `••••${trimmed.slice(-6)}` : "Set";
}

function integrationValues() {
  const env = process.env;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return {
    googleAuth: {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: clientSecret,
    },
    recaptcha: {
      RECAPTCHA_SITE_KEY: env.RECAPTCHA_SITE_KEY,
      RECAPTCHA_SECRET_KEY: env.RECAPTCHA_SECRET_KEY,
    },
    googleCalendar: {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: clientSecret,
      GOOGLE_CALENDAR_REDIRECT_URI,
      TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY,
    },
    email: {
      SMTP_HOST,
      SMTP_USER: process.env.SMTP_USER || SMTP_USER || GMAIL_USER,
      SMTP_PASSWORD:
        process.env.SMTP_PASS ||
        process.env.SMTP_PASSWORD ||
        SMTP_PASSWORD ||
        GMAIL_APP_PASSWORD,
    },
  };
}

export function getIntegrationStatus() {
  const values = integrationValues();
  const emailOAuthMissing = missingVariables({
    GMAIL_USER,
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
  });
  const emailSmtpMissing = missingVariables(values.email);
  const emailMissing = emailOAuthMissing.length === 0 ? [] : emailSmtpMissing;
  return {
    googleAuth: {
      configured: missingVariables(values.googleAuth).length === 0,
      missing: missingVariables(values.googleAuth),
    },
    recaptcha: {
      configured: missingVariables(values.recaptcha).length === 0,
      missing: missingVariables(values.recaptcha),
    },
    googleCalendar: {
      configured: missingVariables(values.googleCalendar).length === 0,
      missing: missingVariables(values.googleCalendar),
    },
    email: { configured: emailMissing.length === 0, missing: emailMissing },
  };
}

export function getIntegrationDetails() {
  const env = process.env;
  return {
    googleAuth: {
      clientIdMasked: maskClientId(GOOGLE_CLIENT_ID),
      siteKey: null,
      redirectUri: null,
      senderAddress: null,
    },
    recaptcha: {
      clientIdMasked: null,
      siteKey: valueIsConfigured(env.RECAPTCHA_SITE_KEY)
        ? env.RECAPTCHA_SITE_KEY.trim()
        : null,
      redirectUri: null,
      senderAddress: null,
    },
    googleCalendar: {
      clientIdMasked: maskClientId(GOOGLE_CLIENT_ID),
      siteKey: null,
      redirectUri:
        GOOGLE_CALENDAR_REDIRECT_URI ||
        `${env.API_BASE_URL || "http://localhost:5000"}/integrations/google-calendar/callback`,
      senderAddress: null,
    },
    email: {
      clientIdMasked: null,
      siteKey: null,
      redirectUri: null,
      senderAddress: MAIL_FROM || GMAIL_USER || SMTP_USER || null,
    },
  };
}

export { valueIsConfigured };
