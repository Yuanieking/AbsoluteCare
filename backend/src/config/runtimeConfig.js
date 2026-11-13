import * as env from "./env.js";
import IntegrationCredential from "../models/integrationCredentialModel.js";
import { decryptSecret } from "../utils/secretBox.js";

const CACHE_TTL_MS = 30_000;

const DEFAULTS = {
  GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  GOOGLE_SECRET_KEY: env.GOOGLE_SECRET_KEY,
  RECAPTCHA_SITE_KEY: env.RECAPTCHA_SITE_KEY,
  RECAPTCHA_SECRET_KEY: env.RECAPTCHA_SECRET_KEY,
  GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
  GOOGLE_CALENDAR_REDIRECT_URI: env.GOOGLE_CALENDAR_REDIRECT_URI,
  GOOGLE_CALENDAR_ENCRYPTION_KEY: env.GOOGLE_CALENDAR_ENCRYPTION_KEY,
  GOOGLE_DRIVE_REDIRECT_URI: env.GOOGLE_DRIVE_REDIRECT_URI,
  GOOGLE_DRIVE_ROOT_FOLDER_ID: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,

  BREVO_API_KEY: env.BREVO_API_KEY,
  MAIL_FROM: env.MAIL_FROM,
};

// Read aliases kept from older installs, in priority order.
const READ_CHAIN = {
  GOOGLE_CLIENT_SECRET: ["GOOGLE_CLIENT_SECRET", "GOOGLE_SECRET_KEY"],
};

let overrides = new Map();
let loadedAt = 0;
let loading = null;

async function load() {
  try {
    const docs = await IntegrationCredential.find({
      clearedAt: null,
      valueEncrypted: { $ne: "" },
    }).lean();
    const next = new Map();
    for (const doc of docs) {
      const value = decryptSecret(doc.valueEncrypted, () =>
        console.error(`credential: cannot decrypt ${doc.key}`),
      );
      if (value) next.set(doc.key, value);
    }
    overrides = next;
  } catch (error) {
    console.error("credential: overrides unavailable:", error.message);
  } finally {
    loadedAt = Date.now();
    loading = null;
  }
}

export function refreshRuntimeConfig() {
  loading ||= load();
  return loading;
}

export function invalidateRuntimeConfigCache() {
  overrides = new Map();
  loadedAt = 0;
  loading = null;
  return refreshRuntimeConfig();
}

function chainFor(key) {
  return READ_CHAIN[key] || [key];
}

export function getIntegrationConfig(key) {
  if (Date.now() - loadedAt > CACHE_TTL_MS) void refreshRuntimeConfig();
  for (const candidate of chainFor(key)) {
    const override = overrides.get(candidate);
    if (override !== undefined) return override;
    const fromEnv = process.env[candidate];
    if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  }
  return DEFAULTS[key] ?? "";
}

export function getIntegrationSource(key) {
  for (const candidate of chainFor(key)) {
    if (overrides.has(candidate)) return "app";
  }
  for (const candidate of chainFor(key)) {
    const fromEnv = process.env[candidate];
    if (typeof fromEnv === "string" && fromEnv.trim()) return "env";
  }
  return DEFAULTS[key] ? "env" : "none";
}

export function hasDbOverride(key) {
  return chainFor(key).some((candidate) => overrides.has(candidate));
}

export function getIntegrationGroup(groupId, keys) {
  return Object.fromEntries(
    keys
      .filter((entry) => entry.group === groupId)
      .map((entry) => [entry.key, getIntegrationConfig(entry.key)]),
  );
}
