import AppSetting from "../models/appSettingModel.js";
import SettingsAuditLog from "../models/settingsAuditLogModel.js";
import SettingsVerification from "../models/settingsVerificationModel.js";
import User from "../models/userModel.js";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import {
  getMailerHealth,
  sendEmail,
  verifyTransport,
} from "../services/mailer.js";
import { verificationCode as renderVerificationCode } from "../emails/templates/index.js";
import { testEmail as renderTestEmail } from "../emails/templates/index.js";
import {
  getSettings,
  integrationStatus,
  invalidateSettingsCache,
  publicSettings,
  getIntegrationDetails,
} from "../services/settingsService.js";
import { getIntegrationStatus } from "../config/integrations.js";
import {
  validateSettingsSection,
  settingsSections,
} from "../schema/settingsSchema.js";

const healthState = new Map();
const verificationActions = new Set([
  "disable_google_auth",
  "disable_recaptcha",
  "disableGoogleAuth",
  "disableRecaptcha",
]);
function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function verificationToken(req, action, token) {
  try {
    const payload = jwt.verify(token || "", JWT_SECRET);
    return payload.purpose === "settings-verification" &&
      payload.adminId === req.user.userId &&
      payload.action === action
      ? payload
      : null;
  } catch {
    return null;
  }
}

function recordHealth(key, ok, error = "") {
  healthState.set(key, {
    lastSuccessfulTest: ok
      ? new Date()
      : healthState.get(key)?.lastSuccessfulTest || null,
    lastError: ok ? "" : error,
  });
}

function healthFor(key) {
  return (
    healthState.get(key) || {
      lastSuccessfulTest: null,
      lastError: "",
    }
  );
}

const integrationFields = {
  googleAuth: "googleAuthEnabled",
  recaptcha: "recaptchaEnabled",
  googleCalendar: "googleCalendarEnabled",
};

function integrationKey(key) {
  return Object.hasOwn(integrationFields, key) ? key : null;
}

async function integrationResponse(key, settings) {
  settings ||= await getSettings();
  const status = getIntegrationStatus()[key];
  const field = integrationFields[key];
  const audit = await SettingsAuditLog.findOne({
    section: "integrations",
    field,
  })
    .sort({ createdAt: -1 })
    .populate("admin", "firstname lastname")
    .lean();
  const lastTest = settings.integrations?.[`${key}LastTest`] || null;
  return {
    key,
    enabled: Boolean(settings.integrations?.[field]),
    configured: status.configured,
    missing: status.missing,
    effectiveEnabled: Boolean(
      settings.integrations?.[field] && status.configured,
    ),
    details: getIntegrationDetails()[key],
    updatedAt: audit?.createdAt || null,
    updatedBy: audit?.admin
      ? {
          id: audit.admin._id,
          name: `${audit.admin.firstname} ${audit.admin.lastname}`.trim(),
        }
      : null,
    lastTest,
  };
}

export async function getIntegrations(req, res) {
  const settings = await getSettings();
  return res.json(
    await Promise.all(
      ["googleAuth", "recaptcha", "googleCalendar", "email"].map((key) =>
        key === "email"
          ? (async () => {
              const status = getIntegrationStatus().email;
              const audit = await SettingsAuditLog.findOne({
                section: "integrations",
                field: "email",
              })
                .sort({ createdAt: -1 })
                .populate("admin", "firstname lastname")
                .lean();
              return {
                key,
                enabled: true,
                configured: status.configured,
                missing: status.missing,
                effectiveEnabled: status.configured,
                details: getIntegrationDetails().email,
                updatedAt: audit?.createdAt || null,
                updatedBy: audit?.admin
                  ? {
                      id: audit.admin._id,
                      name: `${audit.admin.firstname} ${audit.admin.lastname}`.trim(),
                    }
                  : null,
                lastTest: settings.integrations.emailLastTest || null,
              };
            })()
          : integrationResponse(key, settings),
      ),
    ),
  );
}

export async function getPublicSettings(req, res) {
  res.set("Cache-Control", "no-store");
  return res.json(publicSettings(await getSettings()));
}
export async function getAdminSettings(req, res) {
  const settings = await getSettings();
  const status = getIntegrationStatus();
  return res.json({
    settings,
    integrations: {
      google: status.googleAuth.configured,
      recaptcha: status.recaptcha.configured,
      calendar: status.googleCalendar.configured,
      email: status.email.configured,
    },
  });
}

export async function patchSettings(req, res) {
  const { section } = req.params;
  if (!settingsSections.includes(section))
    return res.status(400).json({ message: "Unknown settings section." });
  const { verificationToken: ignoredVerificationToken, ...sectionBody } =
    req.body || {};
  const next = validateSettingsSection(section, sectionBody);
  if (section === "integrations") {
    const configured = integrationStatus();
    const requirements = {
      googleAuthEnabled: configured.googleAuth.configured,
      recaptchaEnabled: configured.recaptcha.configured,
      googleCalendarEnabled: configured.googleCalendar.configured,
    };
    for (const [field, canEnable] of Object.entries(requirements)) {
      if (next[field] === true && !canEnable) {
        return res.status(400).json({
          message: `${field} cannot be enabled until its server integration is configured.`,
          field,
        });
      }
    }
  }
  const current = await AppSetting.findOne({ key: "singleton" });
  const previous = current?.[section]?.toObject?.() || current?.[section] || {};
  const changed = Object.keys(next).filter(
    (field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]),
  );
  const updated = await AppSetting.findOneAndUpdate(
    { key: "singleton" },
    {
      $set: { [section]: next, updatedBy: req.user.userId },
      $inc: { version: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).populate("updatedBy", "firstname lastname");
  await SettingsAuditLog.insertMany(
    changed.map((field) => ({
      admin: req.user.userId,
      section,
      field,
      oldValue: previous[field],
      newValue: next[field],
      ip: req.ip,
    })),
  );
  invalidateSettingsCache();
  return res.json({
    section: updated[section],
    version: updated.version,
    updatedBy: updated.updatedBy,
  });
}

export async function patchIntegration(req, res) {
  const key = integrationKey(req.params.key);
  const bodyKeys = Object.keys(req.body || {});
  if (
    !key ||
    bodyKeys.some((name) => !["enabled", "verificationToken"].includes(name)) ||
    typeof req.body.enabled !== "boolean"
  ) {
    return res.status(400).json({
      message:
        "Provide only enabled and verificationToken for a valid integration.",
    });
  }
  if (key === "email")
    return res.status(400).json({ message: "Email provider has no switch." });
  const field = integrationFields[key];
  const settings = await getSettings();
  const status = getIntegrationStatus()[key];
  if (req.body.enabled && !status.configured) {
    return res
      .status(409)
      .json({ code: "NOT_CONFIGURED", missing: status.missing });
  }
  const current = Boolean(settings.integrations[field]);
  const updated = await AppSetting.findOneAndUpdate(
    { key: "singleton" },
    {
      $set: {
        [`integrations.${field}`]: req.body.enabled,
        updatedBy: req.user.userId,
      },
      $inc: { version: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await SettingsAuditLog.create({
    admin: req.user.userId,
    section: "integrations",
    field,
    oldValue: current,
    newValue: req.body.enabled,
    ip: req.ip,
  });
  invalidateSettingsCache();
  return res.json(await integrationResponse(key, updated.toObject()));
}

export async function getAudit(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const query = req.query.cursor
    ? { createdAt: { $lt: new Date(req.query.cursor) } }
    : {};
  const entries = await SettingsAuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("admin", "firstname lastname")
    .lean();
  return res.json({
    entries,
    nextCursor: entries.length === limit ? entries.at(-1).createdAt : null,
  });
}
export async function testEmail(req, res) {
  const admin = await User.findById(req.user.userId).select("email firstname");
  if (!admin?.email)
    return res
      .status(400)
      .json({ message: "Your account has no email address." });
  const verification = await verifyTransport();
  if (!verification.ok) {
    const lastTest = {
      ok: false,
      message: verification.message,
      checkedAt: new Date(),
    };
    await AppSetting.findOneAndUpdate(
      { key: "singleton" },
      { $set: { "integrations.emailLastTest": lastTest } },
      { upsert: true },
    );
    invalidateSettingsCache();
    recordHealth("email", false, verification.message);
    return res.status(502).json({ ok: false, message: verification.message });
  }
  const result = await sendEmail(
    await renderTestEmail({
      email: admin.email,
      senderAddress: getIntegrationDetails().email.senderAddress,
    }),
  );
  const lastTest = {
    ok: result?.sent === true,
    message: result?.sent ? "Test email sent." : result.userMessage,
    checkedAt: new Date(),
  };
  await AppSetting.findOneAndUpdate(
    { key: "singleton" },
    { $set: { "integrations.emailLastTest": lastTest } },
    { upsert: true },
  );
  invalidateSettingsCache();
  recordHealth("email", lastTest.ok, lastTest.message);
  if (!lastTest.ok)
    return res.status(502).json({ ok: false, message: lastTest.message });
  return res.json({ ok: true, message: "Test email sent." });
}
export async function getImpact(req, res) {
  if (req.query.change === "googleAuthEnabled") {
    const googleUsers = await User.countDocuments({ authProvider: "google" });
    const withoutPassword = await User.countDocuments({
      authProvider: "google",
      password: { $in: [null, ""] },
    });
    return res.json({ googleUsers, withoutPassword });
  }
  return res.json({});
}

export async function requestVerification(req, res) {
  const { action } = req.body || {};
  if (!verificationActions.has(action))
    return res
      .status(400)
      .json({ message: "Unsupported verification action." });
  const recentCount = await SettingsVerification.countDocuments({
    admin: req.user.userId,
    action,
    createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) },
  });
  const admin = await User.findById(req.user.userId).select(
    "email firstname lastname",
  );
  if (!admin?.email)
    return res
      .status(400)
      .json({ message: "Your admin account has no email address." });
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  if (recentCount >= 3)
    return res
      .status(429)
      .json({ code: "RATE_LIMITED", retryAfter: Date.now() + 15 * 60 * 1000 });
  await SettingsVerification.updateMany(
    { admin: req.user.userId, action, consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const verification = await SettingsVerification.create({
    admin: req.user.userId,
    action,
    codeHash: hashValue(code),
    expiresAt,
  });
  const actionLabel =
    action.includes("Recaptcha") || action.includes("recaptcha")
      ? "disabling reCAPTCHA"
      : "disabling Google sign-in";
  const emailPayload = await renderVerificationCode({
    email: admin.email,
    code,
    action: actionLabel,
    adminName: `${admin.firstname} ${admin.lastname}`.trim(),
  });
  const result = await sendEmail(emailPayload);
  if (!result?.sent) {
    await SettingsVerification.deleteOne({ _id: verification._id });
    return res.status(409).json({
      code: "MAILER_NOT_CONFIGURED",
      message: result?.error || "Could not send the verification email.",
    });
  }
  return res.json({
    message: "Verification code sent.",
    maskedEmail: `${admin.email.slice(0, 2)}***${admin.email.slice(admin.email.indexOf("@"))}`,
    expiresAt: verification.expiresAt,
    resendAfter: Date.now() + 60 * 1000,
  });
}

export async function confirmVerification(req, res) {
  const { action, code } = req.body || {};
  if (!verificationActions.has(action) || !/^\d{6}$/.test(String(code || "")))
    return res
      .status(400)
      .json({ message: "Enter the six-digit verification code." });
  const verification = await SettingsVerification.findOne({
    admin: req.user.userId,
    action,
    consumedAt: null,
  }).sort({ createdAt: -1 });
  if (!verification || verification.expiresAt <= new Date())
    return res.status(400).json({
      message: "This verification code has expired. Request a new code.",
    });
  if (verification.attempts >= 5)
    return res
      .status(429)
      .json({ message: "Too many incorrect attempts. Request a new code." });
  const expected = Buffer.from(verification.codeHash, "hex");
  const actual = Buffer.from(hashValue(String(code)), "hex");
  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  ) {
    verification.attempts += 1;
    await verification.save();
    return res.status(400).json({
      code: "VERIFICATION_INVALID",
      attemptsLeft: 5 - verification.attempts,
      message: "That verification code is incorrect.",
    });
  }
  const token = jwt.sign(
    {
      purpose: "settings-verification",
      adminId: req.user.userId,
      action,
      verificationId: verification._id.toString(),
    },
    JWT_SECRET,
    { expiresIn: "2m" },
  );
  verification.consumedAt = null;
  await verification.save();
  return res.json({
    verificationToken: token,
    expiresAt: Date.now() + 2 * 60 * 1000,
  });
}

export async function testIntegration(req, res) {
  const { key } = req.params;
  const normalizedKey = key === "google" ? "googleAuth" : key;
  const status = getIntegrationStatus();
  const allowed = {
    googleAuth: status.googleAuth,
    recaptcha: status.recaptcha,
    googleCalendar: status.googleCalendar,
    email: status.email,
  };
  if (!(normalizedKey in allowed))
    return res.status(400).json({ message: "Unknown integration." });
  const checkedAt = new Date();
  const current = allowed[normalizedKey];
  const result = {
    ok: current.configured,
    message: current.configured
      ? "Credentials accepted."
      : `Missing ${current.missing.join(", ")}.`,
    checkedAt,
  };
  recordHealth(normalizedKey, result.ok, result.ok ? "" : result.message);
  await AppSetting.findOneAndUpdate(
    { key: "singleton" },
    { $set: { [`integrations.${normalizedKey}LastTest`]: result } },
    { upsert: true },
  );
  invalidateSettingsCache();
  return res.status(result.ok ? 200 : 502).json(result);
}

export async function getIntegrationHealth(req, res) {
  const settings = await getSettings();
  const status = getIntegrationStatus();
  return res.json({
    google: {
      configured: status.googleAuth.configured,
      enabled: settings.integrations.googleAuthEnabled,
      ...healthFor("google"),
    },
    recaptcha: {
      configured: status.recaptcha.configured,
      enabled: settings.integrations.recaptchaEnabled,
      ...healthFor("recaptcha"),
    },
    calendar: {
      configured: status.googleCalendar.configured,
      enabled: settings.integrations.googleCalendarEnabled,
      ...healthFor("calendar"),
    },
    email: {
      ...getMailerHealth(),
      enabled: settings.notifications.emailEnabled,
    },
  });
}
