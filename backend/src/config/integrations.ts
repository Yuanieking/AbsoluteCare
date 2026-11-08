import { API_BASE_URL } from "./env.js";
import { getIntegrationConfig, getIntegrationSource } from "./runtimeConfig.js";
import { PLACEHOLDER_VALUES, maskValue } from "./integrationKeys.js";

export interface IntegrationStatus {
  configured: boolean;
  missing: string[];
}

export type IntegrationStatusMap = Record<string, IntegrationStatus> & {
  googleAuth: IntegrationStatus;
  recaptcha: IntegrationStatus;
  googleCalendar: IntegrationStatus;
  googleDrive: IntegrationStatus;
  googleMaps: IntegrationStatus;
  email: IntegrationStatus;
};

export interface IntegrationDetails {
  clientIdMasked: string | null;
  siteKey: string | null;
  redirectUri: string | null;
  senderAddress: string | null;
}

export interface IntegrationSources {
  googleAuth: string;
  recaptcha: string;
  googleCalendar: string;
  googleDrive: string;
  googleMaps: string;
  email: string;
}

export interface IntegrationDetailsMap {
  googleAuth: IntegrationDetails;
  recaptcha: IntegrationDetails;
  googleCalendar: IntegrationDetails;
  googleDrive: IntegrationDetails;
  googleMaps: IntegrationDetails;
  email: IntegrationDetails;
  sources: IntegrationSources;
  [key: string]: IntegrationDetails | IntegrationSources;
}

function valueIsConfigured(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !PLACEHOLDER_VALUES.has(normalized);
}

function missingVariables(values: Record<string, string>): string[] {
  return Object.entries(values)
    .filter(([, value]) => !valueIsConfigured(value))
    .map(([name]) => name);
}

function integrationValues(): Record<string, Record<string, string>> {
  return {
    googleAuth: {
      GOOGLE_CLIENT_ID: getIntegrationConfig("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
    },
    recaptcha: {
      RECAPTCHA_SITE_KEY: getIntegrationConfig("RECAPTCHA_SITE_KEY"),
      RECAPTCHA_SECRET_KEY: getIntegrationConfig("RECAPTCHA_SECRET_KEY"),
    },
    googleCalendar: {
      GOOGLE_CLIENT_ID: getIntegrationConfig("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
      GOOGLE_CALENDAR_REDIRECT_URI: getIntegrationConfig(
        "GOOGLE_CALENDAR_REDIRECT_URI",
      ),
      GOOGLE_CALENDAR_ENCRYPTION_KEY: getIntegrationConfig(
        "GOOGLE_CALENDAR_ENCRYPTION_KEY",
      ),
    },
    googleDrive: {
      GOOGLE_CLIENT_ID: getIntegrationConfig("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
      GOOGLE_DRIVE_REDIRECT_URI: getIntegrationConfig(
        "GOOGLE_DRIVE_REDIRECT_URI",
      ),
    },
    email: {
      BREVO_API_KEY: getIntegrationConfig("BREVO_API_KEY"),
      MAIL_FROM: getIntegrationConfig("MAIL_FROM"),
    },
  };
}

export function getIntegrationStatus(): IntegrationStatusMap {
  const values = integrationValues();
  const googleAuth = values.googleAuth ?? {};
  const recaptcha = values.recaptcha ?? {};
  const googleCalendar = values.googleCalendar ?? {};
  const googleDrive = values.googleDrive ?? {};
  const email = values.email ?? {};
  const emailMissing = missingVariables(email);
  return {
    googleAuth: {
      configured: missingVariables(googleAuth).length === 0,
      missing: missingVariables(googleAuth),
    },
    recaptcha: {
      configured: missingVariables(recaptcha).length === 0,
      missing: missingVariables(recaptcha),
    },
    googleCalendar: {
      configured: missingVariables(googleCalendar).length === 0,
      missing: missingVariables(googleCalendar),
    },
    googleDrive: {
      configured: missingVariables(googleDrive).length === 0,
      missing: missingVariables(googleDrive),
    },
    // Address search and maps use keyless OpenStreetMap services, so there is
    // nothing to configure; only the on/off switch matters.
    googleMaps: { configured: true, missing: [] },
    email: { configured: emailMissing.length === 0, missing: emailMissing },
  };
}

export function getIntegrationDetails(): IntegrationDetailsMap {
  const clientId = getIntegrationConfig("GOOGLE_CLIENT_ID");
  const siteKey = getIntegrationConfig("RECAPTCHA_SITE_KEY");
  const calendarRedirect =
    getIntegrationConfig("GOOGLE_CALENDAR_REDIRECT_URI") ||
    `${API_BASE_URL}/integrations/google-calendar/callback`;
  const sender = getIntegrationConfig("MAIL_FROM") || null;
  return {
    googleAuth: {
      clientIdMasked: maskValue(clientId, "identifier"),
      siteKey: null,
      redirectUri: getIntegrationConfig("GOOGLE_REDIRECT_URI") || null,
      senderAddress: null,
    },
    recaptcha: {
      clientIdMasked: null,
      siteKey: valueIsConfigured(siteKey) ? siteKey.trim() : null,
      redirectUri: null,
      senderAddress: null,
    },
    googleCalendar: {
      clientIdMasked: maskValue(clientId, "identifier"),
      siteKey: null,
      redirectUri: calendarRedirect,
      senderAddress: null,
    },
    googleDrive: {
      clientIdMasked: maskValue(clientId, "identifier"),
      siteKey: null,
      redirectUri:
        getIntegrationConfig("GOOGLE_DRIVE_REDIRECT_URI") ||
        `${API_BASE_URL}/integrations/google-drive/callback`,
      senderAddress: null,
    },
    googleMaps: {
      clientIdMasked: null,
      siteKey: null,
      redirectUri: null,
      senderAddress: null,
    },
    email: {
      clientIdMasked: null,
      siteKey: null,
      redirectUri: null,
      senderAddress: sender,
    },
    sources: {
      googleAuth: getIntegrationSource("GOOGLE_CLIENT_ID"),
      recaptcha: getIntegrationSource("RECAPTCHA_SECRET_KEY"),
      googleCalendar: getIntegrationSource("GOOGLE_CALENDAR_ENCRYPTION_KEY"),
      googleDrive: getIntegrationSource("GOOGLE_DRIVE_REDIRECT_URI"),
      googleMaps: "none",
      email: getIntegrationSource("BREVO_API_KEY"),
    },
  };
}

export { valueIsConfigured };
