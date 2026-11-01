import * as env from "./env.js";
import IntegrationCredential from "../models/integrationCredentialModel.js";
import { decryptSecret } from "../utils/secretBox.js";

const CACHE_TTL_MS = 30_000;

export type IntegrationSource = "app" | "env" | "none";

const DEFAULTS: Record<string, string> = {
  GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  GOOGLE_SECRET_KEY: env.GOOGLE_SECRET_KEY,
  RECAPTCHA_SITE_KEY: env.RECAPTCHA_SITE_KEY,
  RECAPTCHA_SECRET_KEY: env.RECAPTCHA_SECRET_KEY,
  GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
  GOOGLE_CALENDAR_REDIRECT_URI: env.GOOGLE_CALENDAR_REDIRECT_URI,
  GOOGLE_CALENDAR_ENCRYPTION_KEY: env.GOOGLE_CALENDAR_ENCRYPTION_KEY,
  BREVO_API_KEY: env.BREVO_API_KEY,
  MAIL_FROM: env.MAIL_FROM,
};

// Read aliases kept from older installs, in priority order.
const READ_CHAIN: Record<string, string[]> = {
  GOOGLE_CLIENT_SECRET: ["GOOGLE_CLIENT_SECRET", "GOOGLE_SECRET_KEY"],
};

let overrides = new Map<string, string>();
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  try {
    const docs = await IntegrationCredential.find({
      clearedAt: null,
      valueEncrypted: { $ne: "" },
    }).lean();
    const next = new Map<string, string>();
    for (const doc of docs) {
      const value = decryptSecret(doc.valueEncrypted, () =>
        console.error(`credential: cannot decrypt ${doc.key}`),
      );
      if (value) next.set(doc.key, value);
    }
    overrides = next;
  } catch (error) {
    console.error(
      "credential: overrides unavailable:",
      (error as Error).message,
    );
  } finally {
    loadedAt = Date.now();
    loading = null;
  }
}

export function refreshRuntimeConfig(): Promise<void> {
  loading ||= load();
  return loading;
}

export function invalidateRuntimeConfigCache(): Promise<void> {
  overrides = new Map();
  loadedAt = 0;
  loading = null;
  return refreshRuntimeConfig();
}

function chainFor(key: string): string[] {
  return READ_CHAIN[key] || [key];
}

export function getIntegrationConfig(key: string): string {
  if (Date.now() - loadedAt > CACHE_TTL_MS) void refreshRuntimeConfig();
  for (const candidate of chainFor(key)) {
    const override = overrides.get(candidate);
    if (override !== undefined) return override;
    const fromEnv = process.env[candidate];
    if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  }
  return DEFAULTS[key] ?? "";
}

export function getIntegrationSource(key: string): IntegrationSource {
  for (const candidate of chainFor(key)) {
    if (overrides.has(candidate)) return "app";
  }
  for (const candidate of chainFor(key)) {
    const fromEnv = process.env[candidate];
    if (typeof fromEnv === "string" && fromEnv.trim()) return "env";
  }
  return DEFAULTS[key] ? "env" : "none";
}

export function hasDbOverride(key: string): boolean {
  return chainFor(key).some((candidate) => overrides.has(candidate));
}

export function getIntegrationGroup(
  groupId: string,
  keys: Array<{ group: string; key: string }>,
): Record<string, string> {
  return Object.fromEntries(
    keys
      .filter((entry) => entry.group === groupId)
      .map((entry) => [entry.key, getIntegrationConfig(entry.key)]),
  );
}
