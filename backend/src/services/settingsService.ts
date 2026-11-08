import { type Types, type UpdateQuery } from "mongoose";
import AppSetting, {
  type AppSetting as AppSettingData,
} from "../models/appSettingModel.js";
import SettingsAuditLog from "../models/settingsAuditLogModel.js";
import SettingsVerification from "../models/settingsVerificationModel.js";
import User from "../models/userModel.js";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_SECRET_KEY,
  RECAPTCHA_SECRET_KEY,
  RECAPTCHA_SITE_KEY,
} from "../config/env.js";

import { getIntegrationStatus } from "../config/integrations.js";
import { ConflictError } from "../errors/AppError.js";
import { freshFilter, guardFresh } from "./concurrencyService.js";

const integrationDefaults = {
  googleAuthEnabled: true,
  recaptchaEnabled: true,
  googleCalendarEnabled: true,
  googleDriveEnabled: true,
  googleMapsEnabled: true,
  emailEnabled: true,
  reportGenerationEnabled: true,
};

const configured = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

let cache: AppSettingData | null = null;
let cacheExpires = 0;
export const invalidateSettingsCache = (): void => {
  cache = null;
  cacheExpires = 0;
};

export async function getSettings(): Promise<AppSettingData> {
  if (cache && cacheExpires > Date.now()) return cache;
  let settings = await AppSetting.findOne({ key: "singleton" });
  if (!settings) {
    settings = await AppSetting.create({
      key: "singleton",
      integrations: integrationDefaults,
    });
  } else {
    const missing: Record<string, boolean> = {};
    for (const [field, value] of Object.entries(integrationDefaults)) {
      const integrations = settings.integrations as unknown as
        | Record<string, unknown>
        | undefined;
      if (typeof integrations?.[field] !== "boolean") {
        missing[`integrations.${field}`] = value;
      }
    }
    if (Object.keys(missing).length) {
      const updated = await AppSetting.findOneAndUpdate(
        { _id: settings._id },
        { $set: missing } as unknown as UpdateQuery<AppSettingData>,
        { new: true },
      );
      if (updated) settings = updated;
    }
  }
  // The cached value has always been the plain object, not the document.
  const data = settings.toObject() as unknown as AppSettingData;
  cache = data;
  cacheExpires = Date.now() + 60_000;
  return data;
}

export function effectiveIntegrationEnabled(
  settings: AppSettingData | null | undefined,
  key: string,
): boolean {
  const field = `${key}Enabled`;
  const integrations = settings?.integrations as unknown as
    | Record<string, unknown>
    | undefined;
  const status = getIntegrationStatus() as unknown as Record<
    string,
    { configured: boolean } | undefined
  >;
  return Boolean(integrations?.[field] && status[key]?.configured);
}

// Master mail switch. Installs written before the switch existed have no
// stored value, so anything other than an explicit false keeps mail flowing.
export function isEmailSendingEnabled(
  settings: AppSettingData | null | undefined,
): boolean {
  const integrations = settings?.integrations as unknown as
    | Record<string, unknown>
    | undefined;
  return integrations?.emailEnabled !== false;
}

// Master PDF switch. It needs no credentials, so only an explicit false stops
// generation; installs written before the switch existed keep working.
export function isReportGenerationEnabled(
  settings: AppSettingData | null | undefined,
): boolean {
  const integrations = settings?.integrations as unknown as
    | Record<string, unknown>
    | undefined;
  return integrations?.reportGenerationEnabled !== false;
}

export function isRecaptchaRequired(
  settings: AppSettingData | null | undefined,
): boolean {
  const integrations = settings?.integrations as unknown as
    | Record<string, unknown>
    | undefined;
  return Boolean(
    integrations?.recaptchaEnabled &&
    (getIntegrationStatus() as { recaptcha: { configured: boolean } }).recaptcha
      .configured,
  );
}

export function publicSettings(
  settings: AppSettingData,
): Record<string, unknown> {
  const status = getIntegrationStatus();
  const recaptchaEnabled = isRecaptchaRequired(settings);
  const googleMapsEnabled = effectiveIntegrationEnabled(settings, "googleMaps");
  return {
    googleAuthEnabled: Boolean(
      settings.integrations.googleAuthEnabled && status.googleAuth.configured,
    ),
    patientRegistrationEnabled: settings.auth.patientRegistrationEnabled,
    recaptchaEnabled,
    ...(recaptchaEnabled
      ? { recaptchaSiteKey: RECAPTCHA_SITE_KEY.trim() }
      : {}),
    googleMapsEnabled,
    onlineBookingEnabled: settings.booking.onlineBookingEnabled,
    maintenanceMode: settings.system.maintenanceMode,
    maintenanceMessage: settings.system.maintenanceMessage,
    announcement: settings.system.announcement,
    clinicName: settings.general.clinicName,
    phone: settings.general.phone,
    email: settings.general.email,
    termsVersion: settings.auth.termsVersion,
    passwordMinLength: settings.auth.passwordMinLength,
    currency: settings.general.currency,
    timezone: settings.general.timezone,
  };
}

export interface AdminContact {
  email: string;
  firstname: string;
  lastname: string;
}

export async function getAdminContact(
  adminId: string,
): Promise<AdminContact | null> {
  const admin = await User.findById(adminId)
    .select("email firstname lastname")
    .lean();
  return (admin as unknown as AdminContact | null) ?? null;
}

export async function googleAccountImpact(): Promise<{
  googleUsers: number;
  withoutPassword: number;
}> {
  const [googleUsers, withoutPassword] = await Promise.all([
    User.countDocuments({ authProvider: "google" }),
    User.countDocuments({
      authProvider: "google",
      password: { $in: [null, ""] },
    }),
  ]);
  return { googleUsers, withoutPassword };
}

export interface AuditAdmin {
  _id: string;
  firstname: string;
  lastname: string;
}

export interface AuditLogView {
  section: string;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  admin: AuditAdmin | null;
  createdAt: Date;
}

export interface AuditLogInput {
  adminId: string;
  section: string;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string;
  meta?: unknown;
}

// Audit documents store an ObjectId; callers hold the id string from the JWT.
const objectId = (id: string): Types.ObjectId =>
  id as unknown as Types.ObjectId;

export async function latestAudit(
  section: string,
  field: string,
): Promise<AuditLogView | null> {
  const entry = await SettingsAuditLog.findOne({ section, field })
    .sort({ createdAt: -1 })
    .populate("admin", "firstname lastname")
    .lean();
  return (entry as unknown as AuditLogView | null) ?? null;
}

export async function latestAuditForKeys(
  keys: string[],
): Promise<AuditLogView | null> {
  if (!keys.length) return null;
  const entry = await SettingsAuditLog.findOne({
    section: "integrationCredentials",
    field: { $in: keys },
  })
    .sort({ createdAt: -1 })
    .populate("admin", "firstname lastname")
    .lean();
  return (entry as unknown as AuditLogView | null) ?? null;
}

export async function getAuditEntries(
  cursor: string,
  limit: number,
): Promise<AuditLogView[]> {
  const query = cursor ? { createdAt: { $lt: new Date(cursor) } } : {};
  const entries = await SettingsAuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("admin", "firstname lastname")
    .lean();
  return entries as unknown as AuditLogView[];
}

export async function writeSettingsAudit(entry: AuditLogInput): Promise<void> {
  await SettingsAuditLog.create({
    admin: objectId(entry.adminId),
    section: entry.section,
    field: entry.field,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    ip: entry.ip || "",
    ...(entry.meta === undefined ? {} : { meta: entry.meta }),
  });
}

export interface UpdatedSection {
  section: unknown;
  version: number;
  updatedBy: unknown;
}

export async function updateSettingsSection({
  section,
  values,
  adminId,
  ip,
  ifMatch,
}: {
  section: string;
  values: Record<string, unknown>;
  adminId: string;
  ip: string;
  ifMatch?: string | undefined;
}): Promise<UpdatedSection> {
  const current = await AppSetting.findOne({ key: "singleton" });
  // ** Concurrency: fail fast if the settings document changed since the client read it.
  if (current) guardFresh(current, ifMatch);
  // `section` is a runtime key of the settings document.
  const currentData = current
    ? (current.toObject() as unknown as Record<string, unknown>)
    : null;
  const previous =
    (currentData?.[section] as Record<string, unknown> | undefined) ?? {};
  const changed = Object.keys(values).filter(
    (field) =>
      JSON.stringify(previous[field]) !== JSON.stringify(values[field]),
  );
  const update = {
    $set: { [section]: values, updatedBy: adminId },
    $inc: { version: 1 },
  };
  // ** Concurrency: atomic compare-and-swap. Upsert is disabled while guarded, otherwise a
  // ** stale filter would insert a second singleton instead of failing.
  const guard = freshFilter(ifMatch);
  const updated = await AppSetting.findOneAndUpdate(
    { key: "singleton", ...guard },
    update as unknown as UpdateQuery<AppSettingData>,
    { new: true, upsert: !guard.updatedAt, setDefaultsOnInsert: true },
  ).populate("updatedBy", "firstname lastname");
  if (!updated) throw new ConflictError();
  await SettingsAuditLog.insertMany(
    changed.map((field) => ({
      admin: objectId(adminId),
      section,
      field,
      oldValue: previous[field],
      newValue: values[field],
      ip,
    })),
  );
  invalidateSettingsCache();
  // `section` is a runtime key of the settings document.
  const data = updated as unknown as Record<string, unknown>;
  return {
    section: data[section],
    version: data.version as number,
    updatedBy: data.updatedBy,
  };
}

export async function setIntegrationFlag(
  field: string,
  enabled: boolean,
  adminId: string,
  ip: string,
  ifMatch?: string,
): Promise<AppSettingData> {
  const settings = await getSettings();
  const integrations = settings.integrations as unknown as Record<
    string,
    unknown
  >;
  const current = Boolean(integrations?.[field]);
  const update = {
    $set: {
      [`integrations.${field}`]: enabled,
      updatedBy: adminId,
    },
    $inc: { version: 1 },
  };
  // ** Concurrency: compare-and-swap on the singleton's updatedAt; no upsert while guarded.
  const guard = freshFilter(ifMatch);
  const updated = await AppSetting.findOneAndUpdate(
    { key: "singleton", ...guard },
    update as unknown as UpdateQuery<AppSettingData>,
    { new: true, upsert: !guard.updatedAt, setDefaultsOnInsert: true },
  );
  if (!updated) throw new ConflictError();
  await writeSettingsAudit({
    adminId,
    section: "integrations",
    field,
    oldValue: current,
    newValue: enabled,
    ip,
  });
  invalidateSettingsCache();
  return updated.toObject() as unknown as AppSettingData;
}

export async function saveIntegrationTestResult(
  field: string,
  value: unknown,
): Promise<void> {
  await AppSetting.findOneAndUpdate(
    { key: "singleton" },
    {
      $set: { [`integrations.${field}`]: value },
    } as unknown as UpdateQuery<AppSettingData>,
    // ** Concurrency: test-result bookkeeping must not bump updatedAt (false 409s).
    { upsert: true, timestamps: false },
  );
  invalidateSettingsCache();
}

export async function recentVerificationCount(
  adminId: string,
  action: string,
): Promise<number> {
  return SettingsVerification.countDocuments({
    admin: objectId(adminId),
    action,
    createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) },
  });
}

export async function expireOpenVerifications(
  adminId: string,
  action: string,
): Promise<void> {
  await SettingsVerification.updateMany(
    { admin: objectId(adminId), action, consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );
}

export async function createVerificationCode({
  adminId,
  action,
  digest,
  codeHash,
  expiresAt,
}: {
  adminId: string;
  action: string;
  digest: string;
  codeHash: string;
  expiresAt: Date;
}): Promise<{ id: string; expiresAt: Date }> {
  const verification = await SettingsVerification.create({
    admin: objectId(adminId),
    action,
    digest,
    codeHash,
    expiresAt,
  });
  return { id: String(verification._id), expiresAt: verification.expiresAt };
}

export async function deleteVerificationCode(id: string): Promise<void> {
  await SettingsVerification.deleteOne({ _id: id });
}

export interface OpenVerification {
  _id: Types.ObjectId;
  digest: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
}

export async function findOpenVerification(
  adminId: string,
  action: string,
): Promise<OpenVerification | null> {
  const verification = await SettingsVerification.findOne({
    admin: objectId(adminId),
    action,
    consumedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
  return (verification as unknown as OpenVerification | null) ?? null;
}

export async function incrementVerificationAttempts(
  id: Types.ObjectId,
): Promise<number> {
  const updated = await SettingsVerification.findOneAndUpdate(
    { _id: id },
    { $inc: { attempts: 1 } },
    { new: true },
  );
  return updated?.attempts ?? 0;
}

export async function touchVerification(id: Types.ObjectId): Promise<void> {
  // The original handler re-saved the document with consumedAt still null,
  // so the code remains open until the action it authorizes is applied.
  await SettingsVerification.updateOne(
    { _id: id },
    { $set: { consumedAt: null } },
  );
}

export async function consumeVerification(
  verificationId?: string | null,
): Promise<void> {
  if (!verificationId) return;
  try {
    await SettingsVerification.updateOne(
      { _id: verificationId },
      { $set: { consumedAt: new Date() } },
    );
  } catch {
    /* token already spent or trimmed by TTL; nothing to consume */
  }
}
