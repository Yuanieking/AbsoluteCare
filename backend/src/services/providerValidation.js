import { API_BASE_URL, INTEGRATION_VALIDATION } from "../config/env.js";
import { keyDefinition, validateValue } from "../config/integrationKeys.js";
import { getIntegrationConfig } from "../config/runtimeConfig.js";

import { classifyMailError, createMailTransport } from "./mailer.js";

const TIMEOUT_MS = 8000;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const CACHE_TTL_MS = 60_000;

const attempts = new Map();
const cache = new Map();

export function validationAttemptAllowed(adminId) {
  const now = Date.now();
  const recent = (attempts.get(adminId) || []).filter(
    (at) => now - at < ATTEMPT_WINDOW_MS,
  );
  attempts.set(adminId, recent);
  return recent.length < MAX_ATTEMPTS;
}

export function recordValidationAttempt(adminId) {
  const recent = attempts.get(adminId) || [];
  recent.push(Date.now());
  attempts.set(adminId, recent);
}

function timedFetch(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function checkGoogle(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    const fields = {};
    if (!clientId) fields.GOOGLE_CLIENT_ID = "Enter the client ID.";
    if (!clientSecret) fields.GOOGLE_CLIENT_SECRET = "Enter the client secret.";
    return {
      fields,
      message: "Google sign-in needs both a client ID and a client secret.",
    };
  }
  const response = await timedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: "invalid-refresh-token",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body = await response.json().catch(() => ({}));

  const error = String(body.error || "");
  if (error === "invalid_client" || error === "unauthorized_client") {
    return {
      fields: {
        GOOGLE_CLIENT_SECRET:
          "Google rejected this client ID and secret pair. Copy both again from the Google Cloud console.",
      },
      message: "Google rejected these credentials.",
    };
  }
  return null;
}

async function checkRecaptcha(secret, siteKey) {
  // Catches a bad site key already saved, when the Test button runs.
  const siteError = validateValue(
    keyDefinition("RECAPTCHA_SITE_KEY"),
    siteKey,
  );
  if (siteError) {
    return {
      fields: { RECAPTCHA_SITE_KEY: siteError },
      message: "This reCAPTCHA site key is not valid.",
    };
  }
  if (!secret) {
    return {
      fields: { RECAPTCHA_SECRET_KEY: "Enter the secret key." },
      message: "reCAPTCHA needs a secret key.",
    };
  }
  const response = await timedFetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: "invalid-token" }),
    },
  );
  const body = await response.json().catch(() => ({}));

  const codes = body["error-codes"] || [];
  if (
    codes.includes("invalid-input-secret") ||
    codes.includes("missing-input-secret")
  ) {
    return {
      fields: {
        RECAPTCHA_SECRET_KEY: "Google rejected this reCAPTCHA secret key.",
      },
      message: "Google rejected this reCAPTCHA secret.",
    };
  }
  return null;
}

export function candidateMailConfig(values) {
  const apiKey = (values.BREVO_API_KEY || "").trim();
  const from = (values.MAIL_FROM || "").trim();
  const missing = [];
  if (!apiKey) missing.push("BREVO_API_KEY");
  if (!from) missing.push("MAIL_FROM");
  return { apiKey, from, missing };
}

async function checkEmail(values) {
  const config = candidateMailConfig(values);
  if (config.missing.length) {
    return {
      fields: Object.fromEntries(
        config.missing.map((key) => [key, "Enter a value."]),
      ),
      message: `Email settings are incomplete: ${config.missing.join(", ")}.`,
    };
  }
  const transport = createMailTransport(config, TIMEOUT_MS);
  if (!transport) {
    return { fields: {}, message: "Email settings are incomplete." };
  }
  try {
    await transport.verify();
    return null;
  } catch (error) {
    if (Number(error.status || 0) === 429) {
      return {
        fields: {},
        message: "Brevo is rate limiting the check. Try again in a minute.",
      };
    }
    const message = classifyMailError(error).userMessage;
    return { fields: { BREVO_API_KEY: message }, message };
  }
}

function checkCalendar(values) {
  const redirect = (values.GOOGLE_CALENDAR_REDIRECT_URI || "").trim();
  let parsed;
  try {
    parsed = new URL(redirect);
  } catch {
    return {
      fields: {
        GOOGLE_CALENDAR_REDIRECT_URI:
          "Enter the full callback address, starting with https://.",
      },
      message: "The calendar redirect URI is not a valid URL.",
    };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      fields: {
        GOOGLE_CALENDAR_REDIRECT_URI: "Use an http:// or https:// address.",
      },
      message: "The calendar redirect URI must be an http(s) address.",
    };
  }
  const warnings = [];
  try {
    if (parsed.origin !== new URL(API_BASE_URL).origin) {
      warnings.push(
        `This callback is on ${parsed.origin}, but the app is served from ${new URL(API_BASE_URL).origin}. Google must list the exact address you save.`,
      );
    }
  } catch {
    /* API_BASE_URL itself is misconfigured; not the admin's problem here. */
  }
  const key = (values.GOOGLE_CALENDAR_ENCRYPTION_KEY || "").trim();
  if (key && key.length < 16) {
    return {
      fields: {
        GOOGLE_CALENDAR_ENCRYPTION_KEY: "Use at least 16 characters.",
      },
      message: "The encryption key is too short.",
    };
  }
  return { warnings };
}

export async function validateGroup(group, values) {
  if (INTEGRATION_VALIDATION === "off") {
    return { ok: true, fields: {}, warnings: [], skipped: true };
  }

  // Calendar and Drive share the Google OAuth client, which is submitted from
  // another group, so resolve it here (and include it in the cache key).
  const merged =
    group === "googleCalendar" || group === "googleDrive"
      ? {
          ...values,
          GOOGLE_CLIENT_ID:
            values.GOOGLE_CLIENT_ID || getIntegrationConfig("GOOGLE_CLIENT_ID"),
          GOOGLE_CLIENT_SECRET:
            values.GOOGLE_CLIENT_SECRET ||
            getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
        }
      : values;

  const digest = JSON.stringify({ group, values: merged });
  const cached = cache.get(digest);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let failure = null;
  let warnings = [];
  try {
    if (group === "google" || group === "googleDrive") {
      failure = await checkGoogle(
        (merged.GOOGLE_CLIENT_ID || "").trim(),
        (merged.GOOGLE_CLIENT_SECRET || "").trim(),
      );
    } else if (group === "recaptcha") {
      failure = await checkRecaptcha(
        (values.RECAPTCHA_SECRET_KEY || "").trim(),
        (values.RECAPTCHA_SITE_KEY || "").trim(),
      );
    } else if (group === "email") {
      failure = await checkEmail(values);
    } else if (group === "googleCalendar") {
      const calendar = checkCalendar(values);
      failure = "fields" in calendar ? calendar : null;
      warnings = calendar.warnings || [];
      if (!failure) {
        failure = await checkGoogle(
          (merged.GOOGLE_CLIENT_ID || "").trim(),
          (merged.GOOGLE_CLIENT_SECRET || "").trim(),
        );
      }
    }
  } catch {
    failure = {
      fields: {},
      message:
        "Couldn't reach the provider to check these credentials. Nothing was saved. Try again in a moment.",
    };
  }

  const fields = failure?.fields || {};
  for (const [key, reason] of Object.entries(fields)) {
    if (!reason) delete fields[key];
  }
  const result = failure
    ? { ok: false, fields, warnings, message: failure.message }
    : { ok: true, fields: {}, warnings, skipped: false };

  cache.set(digest, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
