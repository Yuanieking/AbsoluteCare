import crypto from "node:crypto";
import type { QueryFilter, Types, UpdateQuery } from "mongoose";
import { API_BASE_URL } from "../config/env.js";
import {
  INTEGRATION_GROUPS,
  LOAD_BEARING_KEYS,
  MANAGED_KEYS,
  groupById,
  groupKeys,
  keyDefinition,
  maskValue,
  validateValue,
  warningFor,
  type IntegrationGroup,
  type IntegrationKeyDefinition,
  type IntegrationKeyKind,
} from "../config/integrationKeys.js";
import { getIntegrationStatus } from "../config/integrations.js";
import {
  getIntegrationConfig,
  getIntegrationSource,
  invalidateRuntimeConfigCache,
  type IntegrationSource,
} from "../config/runtimeConfig.js";
import AppSetting, {
  type AppSetting as AppSettingData,
} from "../models/appSettingModel.js";
import IntegrationCredential, {
  type IntegrationCredential as IntegrationCredentialData,
} from "../models/integrationCredentialModel.js";
import SettingsAuditLog from "../models/settingsAuditLogModel.js";
import User from "../models/userModel.js";
import { decryptSecret, encryptSecret } from "../utils/secretBox.js";
import { rewriteEnvFile, type EnvWriteResult } from "./envWriter.js";
import { getMailerHealth } from "./mailer.js";
import { validateGroup } from "./providerValidation.js";
import { selfRestartSupported, supervisorCommand } from "./restartService.js";
import { getSettings, invalidateSettingsCache } from "./settingsService.js";

const UNMANAGED_KEYS = [
  "NODE_ENV",
  "PORT",
  "MONGO_URI",
  "JWT_SECRET",
  "FRONTEND_URL",
  "API_BASE_URL",
  "ASSETS_BASE_URL",
  "CLINIC_ADDRESS",
  "CORS_ORIGINS",
  "GOOGLE_REDIRECT_URI",
  "SEED_PASSWORD",
  "CREDENTIAL_ENCRYPTION_KEY",
  "ALLOW_SELF_RESTART",
  "INTEGRATION_VALIDATION",
  "ENV_WRITE",
];

export class CredentialError extends Error {
  status: number;
  code: string;
  fields: Record<string, string> | null;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const hashOf = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

// Credential documents hold ObjectIds; callers pass id strings from the JWT.
const objectId = (id: string): Types.ObjectId =>
  id as unknown as Types.ObjectId;

export function digestOf(
  group: string,
  values: Record<string, string>,
): string {
  const body = Object.keys(values || {})
    .sort()
    .map((key) => `${key}=${values[key]}`)
    .join("\n");
  return hashOf(`${group}\n${body}`);
}

export function clearDigest(key: string): string {
  return hashOf(`clear:${key}`);
}

function sourceLabel(source: IntegrationSource): string {
  if (source === "app") return "App";
  if (source === "env") return ".env";
  return "Not set";
}

function redirectUriFor(group: IntegrationGroup): string | null {
  if (group.id === "googleCalendar")
    return (
      getIntegrationConfig("GOOGLE_CALENDAR_REDIRECT_URI") ||
      `${API_BASE_URL}/integrations/google-calendar/callback`
    );
  if (group.redirectPath) return `${API_BASE_URL}${group.redirectPath}`;
  return null;
}

interface CredentialDoc {
  key: string;
  valueEncrypted: string;
  previousEncrypted: string | null;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
  clearedAt: Date | null;
  verifiedAt: Date | null;
}

interface AdminName {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
}

async function adminNames(
  ids: Array<Types.ObjectId | string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const admins = await User.find({ _id: { $in: unique } })
    .select("firstname lastname")
    .lean();
  return new Map(
    (admins as unknown as AdminName[]).map((admin) => [
      String(admin._id),
      `${admin.firstname} ${admin.lastname}`.trim(),
    ]),
  );
}

export interface CredentialKeyView {
  key: string;
  kind: IntegrationKeyKind;
  label: string;
  helper: string | undefined;
  helpUrl: string | null;
  required: boolean;
  sharedWith: string | null;
  loadBearing: boolean;
  masked: string;
  source: IntegrationSource;
  updatedAt: Date | null;
  updatedBy: { id: string; name: string } | null;
  hasPrevious: boolean;
  verified: boolean | null;
}

function shapeKey(
  entry: IntegrationKeyDefinition,
  doc: CredentialDoc | undefined,
  names: Map<string, string>,
): CredentialKeyView {
  const active = Boolean(doc && !doc.clearedAt);
  const value = active
    ? decryptSecret(doc!.valueEncrypted)
    : getIntegrationConfig(entry.key);
  return {
    key: entry.key,
    kind: entry.kind,
    label: entry.label,
    helper: entry.helper,
    helpUrl: entry.helpUrl,
    required: entry.required,
    sharedWith: entry.sharedWith || null,
    loadBearing: Boolean(entry.loadBearing),
    masked: maskValue(value || "", entry.kind),
    source: getIntegrationSource(entry.key),
    updatedAt: active ? doc!.updatedAt : null,
    updatedBy:
      active && doc!.updatedBy
        ? {
            id: String(doc!.updatedBy),
            name: names.get(String(doc!.updatedBy)) || "",
          }
        : null,
    hasPrevious: Boolean(doc?.previousEncrypted),
    verified: active ? Boolean(doc!.verifiedAt) : null,
  };
}

export interface CredentialGroupView {
  id: string;
  title: string;
  purpose: string;
  helpUrl: string;
  redirectUri: string | null;
  connectedAccounts: number | null;
  status: { configured: boolean; missing: string[]; stale: boolean };
  keys: CredentialKeyView[];
}

export interface CredentialGroupsResponse {
  groups: CredentialGroupView[];
  unmanaged: Array<{ key: string; present: boolean }>;
  restart: {
    required: boolean;
    supported: boolean;
    command: string | null;
    requestedAt: Date | null;
  };
  mail: { configured: boolean; ok: boolean | null };
}

export async function credentialGroups(): Promise<CredentialGroupsResponse> {
  const settings = await getSettings();
  const restartRequired = Boolean(settings.integrations?.restartRequired);
  // Lean credential rows mirror this shape; the model type omits timestamps.
  const docs = (await IntegrationCredential.find().lean()) as unknown as
    | CredentialDoc[]
    | null;
  const rows = docs ?? [];
  const byKey = new Map(rows.map((doc) => [doc.key, doc]));
  const names = await adminNames(rows.map((doc) => doc.updatedBy));
  const status = getIntegrationStatus();
  const connectedAccounts = await User.countDocuments({
    "googleCalendar.connected": true,
  });
  const mailer = getMailerHealth();

  const groups = INTEGRATION_GROUPS.map((group) => {
    const groupStatus = status[group.apiKey] || {
      configured: false,
      missing: [],
    };
    return {
      id: group.id,
      title: group.title,
      purpose: group.purpose,
      helpUrl: group.helpUrl,
      redirectUri: redirectUriFor(group),
      connectedAccounts: group.redirectPath ? connectedAccounts : null,
      status: {
        configured: groupStatus.configured,
        missing: groupStatus.missing,
        stale: restartRequired,
      },
      keys: groupKeys(group.id).map((entry) =>
        shapeKey(entry, byKey.get(entry.key), names),
      ),
    };
  });

  return {
    groups,
    unmanaged: UNMANAGED_KEYS.map((key) => ({
      key,
      present: Boolean(process.env[key]),
    })),
    restart: {
      required: restartRequired,
      supported: selfRestartSupported(),
      command: selfRestartSupported() ? null : supervisorCommand(),
      requestedAt: settings.integrations?.restartRequestedAt || null,
    },
    mail: { configured: mailer.configured, ok: mailer.ok },
  };
}

async function markRestartPending(adminId: string): Promise<void> {
  const update = {
    $set: {
      "integrations.restartRequired": true,
      "integrations.restartRequestedAt": new Date(),
      "integrations.restartRequestedBy": objectId(adminId),
    },
  };
  await AppSetting.findOneAndUpdate(
    { key: "singleton" },
    update as unknown as UpdateQuery<AppSettingData>,
    { upsert: true, setDefaultsOnInsert: true },
  );
  invalidateSettingsCache();
  await invalidateRuntimeConfigCache();
}

async function loadDecryptedOverrides(): Promise<Map<string, string>> {
  // Credential rows store the encrypted override per key.
  const docs = (await IntegrationCredential.find({
    clearedAt: null,
    valueEncrypted: { $ne: "" },
  } as QueryFilter<IntegrationCredentialData>).lean()) as unknown as
    | CredentialDoc[]
    | null;
  const map = new Map<string, string>();
  for (const doc of docs ?? []) {
    const value = decryptSecret(doc.valueEncrypted);
    if (value) map.set(doc.key, value);
  }
  return map;
}

async function syncEnvRewrite(): Promise<EnvWriteResult> {
  try {
    return await rewriteEnvFile(await loadDecryptedOverrides());
  } catch (error) {
    const message = (error as Error)?.message || String(error);
    console.error(`env: rewrite failed (${message})`);
    return { outcome: "failed", reason: message };
  }
}

function envOutcomeWarning(outcome: string): string | null {
  if (outcome === "skipped_readonly")
    return "Stored in the app database. The server's .env is read-only, so it wasn't updated.";
  if (outcome === "failed")
    return "Stored in the app database, but writing .env failed (see server logs).";
  if (outcome === "skipped_secondary")
    return "Stored in the app database. The .env file will be written by the primary instance.";
  return null;
}

async function writeAudit({
  adminId,
  key,
  oldValue,
  newValue,
  ip,
  meta,
}: {
  adminId: string;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  ip?: string | undefined;
  meta?: unknown;
}): Promise<void> {
  await SettingsAuditLog.create({
    admin: objectId(adminId),
    section: "integrationCredentials",
    field: key,
    oldValue,
    newValue,
    ip: ip ?? "",
    ...(meta === undefined ? {} : { meta }),
  });
}

export interface SaveCredentialsParams {
  group: string;
  values?: Record<string, string>;
  adminId: string;
  ip?: string;
  confirmKeyRotation?: boolean;
  bootstrap?: boolean;
  dryRun?: boolean;
}

export type SaveCredentialsResult =
  | { digest: string; warnings: string[] }
  | {
      group: CredentialGroupView | undefined;
      restartRequired: boolean;
      envWrite: string;
      warnings: string[];
    };

interface CredentialChange {
  entry: IntegrationKeyDefinition;
  key: string;
  value: string;
  hash: string;
  previous: string | null;
}

export async function saveCredentials({
  group,
  values = {},
  adminId,
  ip,
  confirmKeyRotation = false,
  bootstrap = false,
  dryRun = false,
}: SaveCredentialsParams): Promise<SaveCredentialsResult> {
  if (!groupById(group))
    throw new CredentialError(400, "UNKNOWN_GROUP", "Unknown integration.");
  const entries = groupKeys(group);
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));

  const submitted = Object.entries(values).filter(
    ([, value]) => typeof value === "string",
  );
  if (!submitted.length)
    throw new CredentialError(
      400,
      "NO_CHANGES",
      "Enter a new value for at least one field.",
    );

  const fields: Record<string, string> = {};
  const warnings: string[] = [];
  for (const [key, raw] of submitted) {
    const entry = byKey.get(key);
    if (!entry)
      throw new CredentialError(
        400,
        "UNKNOWN_KEY",
        `${key} is not part of this integration.`,
      );
    const error = validateValue(entry, raw);
    if (error) fields[key] = error;
  }
  if (Object.keys(fields).length)
    throw new CredentialError(
      422,
      "INVALID_VALUE",
      "Check the highlighted fields.",
      fields,
    );

  const docs = (await IntegrationCredential.find({
    key: { $in: [...byKey.keys()] },
  } as QueryFilter<IntegrationCredentialData>).lean()) as unknown as
    | CredentialDoc[]
    | null;
  const existing = new Map((docs ?? []).map((doc) => [doc.key, doc]));

  const changes: CredentialChange[] = [];
  for (const [key, raw] of submitted) {
    const entry = byKey.get(key);
    if (!entry) continue;
    const value = raw.trim();
    const doc = existing.get(key);
    const current =
      doc && !doc.clearedAt
        ? decryptSecret(doc.valueEncrypted)
        : getIntegrationConfig(key);
    if ((current || "").trim() === value) continue;
    const warning = warningFor(entry, value);
    if (warning) warnings.push(`${key}: ${warning}`);
    changes.push({
      entry,
      key,
      value,
      hash: hashOf(value),
      previous: doc?.valueEncrypted || null,
    });
  }

  if (!changes.length)
    throw new CredentialError(
      400,
      "NO_CHANGES",
      "Those values are already saved.",
    );

  const rotations = changes.filter((change) =>
    LOAD_BEARING_KEYS.has(change.key),
  );
  if (rotations.length && !confirmKeyRotation)
    throw new CredentialError(
      409,
      "ROTATION_CONFIRMATION_REQUIRED",
      "Changing this disconnects connected calendars. Confirm that those accounts must reconnect.",
      { key: rotations[0]!.key },
    );

  const candidate: Record<string, string> = {};
  for (const entry of entries) {
    candidate[entry.key] =
      values[entry.key]?.trim() || getIntegrationConfig(entry.key);
  }
  const validation = await validateGroup(group, candidate);
  if (!validation.ok)
    throw new CredentialError(
      422,
      "INVALID_CREDENTIALS",
      validation.message ?? "Check the highlighted fields.",
      validation.fields,
    );

  if (dryRun)
    return {
      digest: digestOf(
        group,
        Object.fromEntries(changes.map((change) => [change.key, change.value])),
      ),
      warnings: validation.warnings || [],
    };

  const now = new Date();
  for (const change of changes) {
    const encrypted = encryptSecret(change.value);
    await IntegrationCredential.findOneAndUpdate(
      { key: change.key },
      {
        $set: {
          group,
          valueEncrypted: encrypted,
          valueHash: change.hash,
          previousEncrypted: change.previous,
          fingerprint: maskValue(change.value, change.entry.kind),
          updatedBy: objectId(adminId),
          clearedAt: null,
          verifiedAt: bootstrap ? null : now,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    if (change.key === "GOOGLE_SECRET_KEY" && !values.GOOGLE_CLIENT_SECRET) {
      await IntegrationCredential.findOneAndUpdate(
        { key: "GOOGLE_CLIENT_SECRET" },
        {
          $set: {
            group: "google",
            valueEncrypted: encrypted,
            valueHash: change.hash,
            fingerprint: maskValue(change.value, "secret"),
            updatedBy: objectId(adminId),
            clearedAt: null,
            verifiedAt: bootstrap ? null : now,
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
  }

  let affectedAccounts = 0;
  if (rotations.length) {
    affectedAccounts = await User.countDocuments({
      "googleCalendar.connected": true,
    });
    await User.updateMany(
      { "googleCalendar.connected": true },
      { $set: { "googleCalendar.needsReconnect": true } },
    );
  }

  const envResult = await syncEnvRewrite();

  for (const change of changes) {
    const doc = existing.get(change.key);
    const previous =
      doc && !doc.clearedAt
        ? decryptSecret(doc.valueEncrypted)
        : getIntegrationConfig(change.key);
    await writeAudit({
      adminId,
      key: change.key,
      oldValue: maskValue(previous || "", change.entry.kind),
      newValue: maskValue(change.value, change.entry.kind),
      ip,
      meta: {
        bootstrap: Boolean(bootstrap),
        keyRotation: LOAD_BEARING_KEYS.has(change.key),
        affectedAccounts,
        validated: !validation.skipped,
        envWrite: envResult.outcome,
      },
    });
  }

  await markRestartPending(adminId);

  warnings.push(...(validation.warnings || []));
  if (bootstrap) warnings.push("mail_unverified_bootstrap");
  const envWarning = envOutcomeWarning(envResult.outcome);
  if (envWarning) warnings.push(envWarning);

  const { groups } = await credentialGroups();
  return {
    group: groups.find((item) => item.id === group),
    restartRequired: true,
    envWrite: envResult.outcome,
    warnings,
  };
}

export interface CredentialChangeResult {
  group: CredentialGroupView | undefined;
  envWrite: string;
  message?: string;
}

export async function clearCredential({
  key,
  adminId,
  ip,
}: {
  key: string;
  adminId: string;
  ip?: string;
}): Promise<CredentialChangeResult> {
  const entry = keyDefinition(key);
  if (!entry)
    throw new CredentialError(
      400,
      "UNKNOWN_KEY",
      "That key is not managed here.",
    );
  const doc = await IntegrationCredential.findOne({ key });
  if (!doc || doc.clearedAt)
    throw new CredentialError(
      409,
      "NO_OVERRIDE",
      "This key already falls back to the server environment.",
    );
  const previous = decryptSecret(doc.valueEncrypted) || "";

  doc.previousEncrypted = doc.valueEncrypted || doc.previousEncrypted;
  doc.valueEncrypted = "";
  doc.valueHash = "";
  doc.fingerprint = "";
  doc.clearedAt = new Date();
  doc.updatedBy = objectId(adminId);
  await doc.save();

  const envResult = await syncEnvRewrite();

  await writeAudit({
    adminId,
    key,
    oldValue: maskValue(previous, entry.kind),
    newValue: "reverted to .env",
    ip,
    meta: { envWrite: envResult.outcome },
  });
  await markRestartPending(adminId);

  const { groups } = await credentialGroups();
  return {
    group: groups.find((item) => item.id === entry.group),
    envWrite: envResult.outcome,
  };
}

export async function rollbackCredential({
  key,
  adminId,
  ip,
}: {
  key: string;
  adminId: string;
  ip?: string;
}): Promise<CredentialChangeResult> {
  const entry = keyDefinition(key);
  if (!entry)
    throw new CredentialError(
      400,
      "UNKNOWN_KEY",
      "That key is not managed here.",
    );
  const doc = await IntegrationCredential.findOne({ key });
  if (!doc?.previousEncrypted)
    throw new CredentialError(
      409,
      "NO_PREVIOUS",
      "There is no previous value to restore.",
    );
  const restored = decryptSecret(doc.previousEncrypted);
  if (restored === null)
    throw new CredentialError(
      409,
      "NO_PREVIOUS",
      "The previous value can't be read with the current encryption key.",
    );
  const current = decryptSecret(doc.valueEncrypted) || "";

  doc.previousEncrypted = null;
  doc.valueEncrypted = encryptSecret(restored);
  doc.valueHash = hashOf(restored);
  doc.fingerprint = maskValue(restored, entry.kind);
  doc.clearedAt = null;
  doc.updatedBy = objectId(adminId);
  doc.verifiedAt = new Date();
  await doc.save();

  const envResult = await syncEnvRewrite();

  await writeAudit({
    adminId,
    key,
    oldValue: maskValue(current, entry.kind),
    newValue: maskValue(restored, entry.kind),
    ip,
    meta: { rollback: true, envWrite: envResult.outcome },
  });
  await markRestartPending(adminId);

  const { groups } = await credentialGroups();
  return {
    group: groups.find((item) => item.id === entry.group),
    envWrite: envResult.outcome,
    message: "Restored the previous value. Run a test to confirm it works.",
  };
}

export interface CredentialTestResult {
  ok: boolean;
  message: string;
  checkedAt: Date;
  fields: Record<string, string>;
  warnings: string[];
}

export async function testGroup(
  groupId: string,
): Promise<CredentialTestResult> {
  const definition = groupById(groupId);
  if (!definition)
    throw new CredentialError(400, "UNKNOWN_GROUP", "Unknown integration.");
  const values: Record<string, string> = {};
  for (const entry of groupKeys(groupId))
    values[entry.key] = getIntegrationConfig(entry.key);

  const result = await validateGroup(groupId, values);
  const lastTest = {
    ok: result.ok,
    message: result.ok ? "Credentials accepted." : (result.message ?? ""),
    checkedAt: new Date(),
  };
  const update = {
    $set: { [`integrations.${definition.apiKey}LastTest`]: lastTest },
  };
  await AppSetting.findOneAndUpdate(
    { key: "singleton" },
    update as unknown as UpdateQuery<AppSettingData>,
    { upsert: true, setDefaultsOnInsert: true },
  );
  invalidateSettingsCache();
  return { ...lastTest, fields: result.fields, warnings: result.warnings };
}

/**
 * Deletes encrypted rows for keys that are no longer in the registry, so the
 * retired SMTP/Gmail credentials do not linger in the database.
 */
export async function pruneRetiredCredentials(): Promise<void> {
  try {
    const stale = (await IntegrationCredential.find({
      key: { $nin: [...MANAGED_KEYS] },
    } as QueryFilter<IntegrationCredentialData>
      ).select("key")
      .lean()) as unknown as Array<{ key: string }> | null;
    const keys = (stale ?? [])
      .map((doc) => String(doc.key || ""))
      .filter(Boolean);
    if (!keys.length) return;
    await IntegrationCredential.deleteMany({
      key: { $in: keys },
    } as QueryFilter<IntegrationCredentialData>);
    console.log(
      `credential: pruned ${keys.length} retired keys (${keys.join(", ")})`,
    );
  } catch (error) {
    console.error(
      "credential: prune failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function markRestartApplied(): Promise<void> {
  const settings = await getSettings();
  if (!settings.integrations?.restartRequired) return;
  const update = {
    $set: {
      "integrations.restartRequired": false,
      "integrations.restartAppliedVersion": settings.version || 0,
    },
  };
  await AppSetting.findOneAndUpdate(
    { key: "singleton" },
    update as unknown as UpdateQuery<AppSettingData>,
  );
  invalidateSettingsCache();
}

export async function handoverMarkdown(adminName: string): Promise<string> {
  const { groups, unmanaged, restart } = await credentialGroups();
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    "# AbsoluteCare — integration handover",
    "",
    `Generated ${date} by ${adminName}. No secret values are included in this file.`,
    "",
    "## Summary",
    "",
    "| Integration | Status |",
    "| --- | --- |",
    ...groups.map(
      (group) =>
        `| ${group.title} | ${
          group.status.configured
            ? "Configured"
            : `Missing ${group.status.missing.join(", ")}`
        } |`,
    ),
    "",
  ];

  for (const group of groups) {
    lines.push(`## ${group.title}`, "", group.purpose, "", "Keys:", "");
    for (const key of group.keys) {
      lines.push(
        `- ${key.key} — ${key.masked} — ${sourceLabel(key.source)}${
          key.required ? " — required" : ""
        }`,
      );
    }
    if (group.redirectUri)
      lines.push("", `Register redirect URI: ${group.redirectUri}`);
    if (group.helpUrl) lines.push("", `Obtain: ${group.helpUrl}`);
    lines.push("");
  }

  lines.push(
    "## Environment template",
    "",
    "Copy `backend/.env.example` on the new server and fill in these keys. Values are never exported.",
    "",
    ...groups.flatMap((group) =>
      group.keys.map((key) => `${key.key}=<set on new server>`),
    ),
    "",
    "Unmanaged keys that must also be carried over:",
    "",
    unmanaged
      .filter((item) => item.present)
      .map((item) => item.key)
      .join(", ") || "none",
    "",
  );

  if (restart.required)
    lines.push(
      "> A saved credential change is waiting for a restart on the current server.",
      "",
    );

  return lines.join("\n");
}
