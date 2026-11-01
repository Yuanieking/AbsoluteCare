import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { JWT_SECRET } from "../config/env.js";
import {
  getMailerHealth,
  sendEmail,
  verifyTransport,
} from "../services/mailer.js";
import {
  testEmail as renderTestEmail,
  verificationCode as renderVerificationCode,
} from "../emails/templates/index.js";
import {
  createVerificationCode,
  deleteVerificationCode,
  expireOpenVerifications,
  findOpenVerification,
  getAdminContact,
  getAuditEntries,
  getSettings,
  googleAccountImpact,
  incrementVerificationAttempts,
  latestAudit,
  latestAuditForKeys,
  publicSettings,
  recentVerificationCount,
  saveIntegrationTestResult,
  setIntegrationFlag,
  touchVerification,
  updateSettingsSection,
  writeSettingsAudit,
} from "../services/settingsService.js";
import {
  getIntegrationDetails,
  getIntegrationStatus,
} from "../config/integrations.js";
import { INTEGRATION_GROUPS, groupKeys } from "../config/integrationKeys.js";
import {
  settingsSections,
  validateSettingsSection,
} from "../schemas/settingsSchema.js";
import {
  CredentialError,
  clearDigest,
  digestOf,
  handoverMarkdown,
  saveCredentials,
  testGroup,
} from "../services/integrationCredentialService.js";
import {
  isPrimaryInstance,
  restartCooldownRemaining,
  selfRestartSupported,
  supervisorCommand,
  triggerRestart,
} from "../services/restartService.js";
import { parseAction, trimValues } from "../services/verificationActions.js";

interface HealthEntry {
  lastSuccessfulTest: Date | null;
  lastError: string;
}

interface IntegrationStatus {
  configured: boolean;
  missing: string[];
}

type SettingsData = Awaited<ReturnType<typeof getSettings>>;

const healthState = new Map<string, HealthEntry>();

const integrationFields = {
  googleAuth: "googleAuthEnabled",
  recaptcha: "recaptchaEnabled",
  googleCalendar: "googleCalendarEnabled",
  email: "emailEnabled",
} as const;

type IntegrationKey = keyof typeof integrationFields;

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function integrationKey(key: unknown): string | null {
  const value = String(key ?? "");
  return Object.hasOwn(integrationFields, value) ? value : null;
}

function statusMap(): Record<string, IntegrationStatus> {
  return getIntegrationStatus() as unknown as Record<string, IntegrationStatus>;
}

function integrationsOf(settings: SettingsData): Record<string, unknown> {
  // Integration last-test fields are dynamic keys on the typed settings object.
  return settings.integrations as unknown as Record<string, unknown>;
}

function detailsMap(): Record<string, unknown> {
  return getIntegrationDetails() as unknown as Record<string, unknown>;
}

function recordHealth(key: string, ok: boolean, error = ""): void {
  healthState.set(key, {
    lastSuccessfulTest: ok
      ? new Date()
      : healthState.get(key)?.lastSuccessfulTest || null,
    lastError: ok ? "" : error,
  });
}

function healthFor(key: string): HealthEntry {
  return (
    healthState.get(key) || {
      lastSuccessfulTest: null,
      lastError: "",
    }
  );
}

function updatedByOf(
  audit: Awaited<ReturnType<typeof latestAudit>>,
): { id: string; name: string } | null {
  return audit?.admin
    ? {
        id: audit.admin._id,
        name: `${audit.admin.firstname} ${audit.admin.lastname}`.trim(),
      }
    : null;
}

function newerAudit(
  first: Awaited<ReturnType<typeof latestAudit>>,
  second: Awaited<ReturnType<typeof latestAuditForKeys>>,
): Awaited<ReturnType<typeof latestAudit>> {
  if (!first) return second as Awaited<ReturnType<typeof latestAudit>>;
  if (!second) return first;
  return new Date(second.createdAt) > new Date(first.createdAt)
    ? (second as unknown as Awaited<ReturnType<typeof latestAudit>>)
    : first;
}

function credentialKeysFor(apiKey: string): string[] {
  const group = INTEGRATION_GROUPS.find((item) => item.apiKey === apiKey);
  return group ? groupKeys(group.id).map((entry) => entry.key) : [];
}

async function integrationResponse(key: string, settings?: SettingsData) {
  const current = settings ?? (await getSettings());
  const status = statusMap()[key]!;
  const field = integrationFields[key as IntegrationKey];
  const [toggleAudit, credentialAudit] = await Promise.all([
    latestAudit("integrations", field),
    latestAuditForKeys(credentialKeysFor(key)),
  ]);
  const audit = newerAudit(toggleAudit, credentialAudit);
  const values = integrationsOf(current);
  return {
    key,
    enabled: Boolean(values[field]),
    configured: status.configured,
    missing: status.missing,
    effectiveEnabled: Boolean(values[field] && status.configured),
    details: detailsMap()[key],
    updatedAt: audit?.createdAt || null,
    updatedBy: updatedByOf(audit),
    lastTest: values[`${key}LastTest`] || null,
  };
}

export async function getIntegrations(
  req: Request,
  res: Response,
): Promise<void> {
  const settings = await getSettings();
  res.json(
    await Promise.all(
      ["googleAuth", "recaptcha", "googleCalendar", "email"].map((key) =>
        integrationResponse(key, settings),
      ),
    ),
  );
}

export async function getPublicSettings(
  req: Request,
  res: Response,
): Promise<void> {
  res.set("Cache-Control", "no-store");
  res.json(publicSettings(await getSettings()));
}

export async function getAdminSettings(
  req: Request,
  res: Response,
): Promise<void> {
  const settings = await getSettings();
  const status = statusMap();
  res.json({
    settings,
    integrations: {
      google: status.googleAuth!.configured,
      recaptcha: status.recaptcha!.configured,
      calendar: status.googleCalendar!.configured,
      email: status.email!.configured,
    },
  });
}

export async function patchSettings(
  req: Request,
  res: Response,
): Promise<void> {
  const section = String(req.params.section ?? "");
  if (!settingsSections.includes(section)) {
    res.status(400).json({ message: "Unknown settings section." });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { verificationToken: ignoredVerificationToken, ...sectionBody } = body;
  void ignoredVerificationToken;
  const next = validateSettingsSection(section, sectionBody);
  if (section === "integrations") {
    const configured = statusMap();
    const requirements: Record<string, boolean> = {
      googleAuthEnabled: configured.googleAuth!.configured,
      recaptchaEnabled: configured.recaptcha!.configured,
      googleCalendarEnabled: configured.googleCalendar!.configured,
      emailEnabled: configured.email!.configured,
    };
    const labels: Record<string, string> = {
      googleAuthEnabled: "Google sign-in",
      recaptchaEnabled: "reCAPTCHA",
      googleCalendarEnabled: "Google Calendar",
      emailEnabled: "Email provider",
    };
    for (const [field, canEnable] of Object.entries(requirements)) {
      if (next[field] === true && !canEnable) {
        res.status(400).json({
          message: `${labels[field] || field} can't be enabled until its server credentials are configured.`,
          field,
        });
        return;
      }
    }
  }
  const updated = await updateSettingsSection({
    section,
    values: next,
    adminId: req.user.userId,
    ip: req.ip ?? "",
  });
  res.json({
    section: updated.section,
    version: updated.version,
    updatedBy: updated.updatedBy,
  });
}

export async function patchIntegration(
  req: Request,
  res: Response,
): Promise<void> {
  const key = integrationKey(req.params.key);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const bodyKeys = Object.keys(body);
  if (
    !key ||
    bodyKeys.some((name) => !["enabled", "verificationToken"].includes(name)) ||
    typeof body.enabled !== "boolean"
  ) {
    res.status(400).json({
      message:
        "Provide only enabled and verificationToken for a valid integration.",
    });
    return;
  }
  const field = integrationFields[key as IntegrationKey];
  const status = statusMap()[key]!;
  if (body.enabled && !status.configured) {
    res.status(409).json({ code: "NOT_CONFIGURED", missing: status.missing });
    return;
  }
  const updated = await setIntegrationFlag(
    field,
    Boolean(body.enabled),
    req.user.userId,
    req.ip ?? "",
  );
  res.json(await integrationResponse(key, updated));
}

export async function getAudit(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const cursor = req.query.cursor ? String(req.query.cursor) : "";
  const entries = await getAuditEntries(cursor, limit);
  res.json({
    entries,
    nextCursor:
      entries.length === limit ? (entries.at(-1)?.createdAt ?? null) : null,
  });
}

export async function testEmail(req: Request, res: Response): Promise<void> {
  const admin = await getAdminContact(req.user.userId);
  if (!admin?.email) {
    res.status(400).json({ message: "Your account has no email address." });
    return;
  }
  const verification = await verifyTransport();
  if (!verification.ok) {
    const lastTest = {
      ok: false,
      message: verification.message,
      checkedAt: new Date(),
    };
    await saveIntegrationTestResult("emailLastTest", lastTest);
    recordHealth("email", false, verification.message);
    res.status(502).json({ ok: false, message: verification.message });
    return;
  }
  const sender = detailsMap().email as { senderAddress?: string | null };
  const result = await sendEmail(
    await renderTestEmail({
      email: admin.email,
      senderAddress: sender.senderAddress ?? "",
    }),
  );
  const lastTest = result.sent
    ? { ok: true, message: "Test email sent.", checkedAt: new Date() }
    : { ok: false, message: result.userMessage, checkedAt: new Date() };
  await saveIntegrationTestResult("emailLastTest", lastTest);
  recordHealth("email", lastTest.ok, lastTest.message);
  if (!lastTest.ok) {
    res.status(502).json({ ok: false, message: lastTest.message });
    return;
  }
  res.json({ ok: true, message: "Test email sent." });
}

export async function getImpact(req: Request, res: Response): Promise<void> {
  if (req.query.change === "googleAuthEnabled") {
    res.json(await googleAccountImpact());
    return;
  }
  res.json({});
}

export async function requestVerification(
  req: Request,
  res: Response,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const parsed = parseAction(body.action);
  if (!parsed) {
    res.status(400).json({ message: "Unsupported verification action." });
    return;
  }

  let digest = "";
  if (parsed.kind === "rotate") {
    const trimmed = trimValues(body.values);
    if (!Object.keys(trimmed).length) {
      res.status(400).json({
        code: "NO_CHANGES",
        message: "Enter a new value before requesting a code.",
      });
      return;
    }
    try {
      await saveCredentials({
        group: parsed.target ?? "",
        values: trimmed,
        adminId: req.user.userId,
        ip: req.ip ?? "",
        confirmKeyRotation: Boolean(body.confirmKeyRotation),
        dryRun: true,
      });
    } catch (error) {
      if (error instanceof CredentialError) {
        res.status(error.status).json({
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        });
        return;
      }
      throw error;
    }
    digest = digestOf(parsed.target ?? "", trimmed);
  } else if (parsed.kind !== "toggle") {
    digest = clearDigest(parsed.target ?? "");
  }

  const recentCount = await recentVerificationCount(
    req.user.userId,
    parsed.action,
  );
  const admin = await getAdminContact(req.user.userId);
  if (!admin?.email) {
    res
      .status(400)
      .json({ message: "Your admin account has no email address." });
    return;
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  if (recentCount >= 3) {
    res.status(429).json({
      code: "RATE_LIMITED",
      retryAfter: Date.now() + 15 * 60 * 1000,
    });
    return;
  }
  await expireOpenVerifications(req.user.userId, parsed.action);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const verification = await createVerificationCode({
    adminId: req.user.userId,
    action: parsed.action,
    digest,
    codeHash: hashValue(code),
    expiresAt,
  });
  const actionLabel =
    parsed.kind === "rotate"
      ? `changing the ${parsed.target} credentials`
      : parsed.kind === "clear"
        ? `reverting a credential to the server environment`
        : parsed.kind === "rollback"
          ? `restoring a previous credential value`
          : parsed.action.includes("Recaptcha") ||
              parsed.action.includes("recaptcha")
            ? "disabling reCAPTCHA"
            : "disabling Google sign-in";
  const emailPayload = await renderVerificationCode({
    email: admin.email,
    code,
    action: actionLabel,
    adminName: `${admin.firstname} ${admin.lastname}`.trim(),
  });
  const result = await sendEmail(emailPayload);
  if (!result.sent) {
    await deleteVerificationCode(verification.id);
    res.status(409).json({
      code: "MAILER_NOT_CONFIGURED",
      message: result.error || "Could not send the verification email.",
    });
    return;
  }
  res.json({
    message: "Verification code sent.",
    maskedEmail: `${admin.email.slice(0, 2)}***${admin.email.slice(admin.email.indexOf("@"))}`,
    expiresAt: verification.expiresAt,
    resendAfter: Date.now() + 60 * 1000,
    digest,
  });
}

export async function confirmVerification(
  req: Request,
  res: Response,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const code = String(body.code ?? "");
  if (!parseAction(body.action) || !/^\d{6}$/.test(code)) {
    res.status(400).json({ message: "Enter the six-digit verification code." });
    return;
  }
  const verification = await findOpenVerification(req.user.userId, action);
  if (!verification || verification.expiresAt <= new Date()) {
    res.status(400).json({
      message: "This verification code has expired. Request a new code.",
    });
    return;
  }
  if (verification.attempts >= 5) {
    res.status(429).json({
      message: "Too many incorrect attempts. Request a new code.",
    });
    return;
  }
  const expected = Buffer.from(verification.codeHash, "hex");
  const actual = Buffer.from(hashValue(code), "hex");
  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  ) {
    const attempts = await incrementVerificationAttempts(verification._id);
    res.status(400).json({
      code: "VERIFICATION_INVALID",
      attemptsLeft: 5 - attempts,
      message: "That verification code is incorrect.",
    });
    return;
  }
  const token = jwt.sign(
    {
      purpose: "settings-verification",
      adminId: req.user.userId,
      action,
      digest: verification.digest || "",
      verificationId: String(verification._id),
    },
    JWT_SECRET,
    { expiresIn: "2m" },
  );
  await touchVerification(verification._id);
  res.json({
    verificationToken: token,
    expiresAt: Date.now() + 2 * 60 * 1000,
  });
}

const testableGroups: Record<string, { group: string; health: string }> = {
  googleAuth: { group: "google", health: "google" },
  recaptcha: { group: "recaptcha", health: "recaptcha" },
  googleCalendar: { group: "googleCalendar", health: "calendar" },
  email: { group: "email", health: "email" },
};

export async function testIntegration(
  req: Request,
  res: Response,
): Promise<void> {
  const key = String(req.params.key ?? "");
  const normalizedKey = key === "google" ? "googleAuth" : key;
  const target = testableGroups[normalizedKey];
  if (!target) {
    res.status(400).json({ message: "Unknown integration." });
    return;
  }
  // Test the resolved credentials against the provider, not just their presence.
  const result = await testGroup(target.group);
  recordHealth(target.health, result.ok, result.ok ? "" : result.message);
  res.status(result.ok ? 200 : 502).json({
    ok: result.ok,
    message: result.message,
    checkedAt: result.checkedAt,
    ...(Object.keys(result.fields).length ? { fields: result.fields } : {}),
    ...(result.warnings.length ? { warnings: result.warnings } : {}),
  });
}

export async function requestRestart(
  req: Request,
  res: Response,
): Promise<void> {
  if (!selfRestartSupported()) {
    res.status(409).json({
      code: "RESTART_UNSUPPORTED",
      command: supervisorCommand(),
      message:
        "This server restarts under a supervisor. Restart it there to apply the change.",
    });
    return;
  }
  const cooldown = restartCooldownRemaining();
  if (cooldown > 0) {
    res.status(429).json({
      code: "RESTART_COOLDOWN",
      retryAfter: cooldown,
      message: "A restart was requested moments ago. Wait a minute.",
    });
    return;
  }

  const restartId = crypto.randomUUID();
  await writeSettingsAudit({
    adminId: req.user.userId,
    section: "integrationCredentials",
    field: "restart",
    newValue: "requested",
    ip: req.ip ?? "",
    meta: { restartId },
  });

  if (!isPrimaryInstance()) {
    console.log("restart: skipped on a non-primary instance");
    res.status(202).json({ restartId, expectedDownMs: 20000 });
    return;
  }

  res.status(202).json({ restartId, expectedDownMs: 20000 });
  triggerRestart();
}

export async function downloadHandover(
  req: Request,
  res: Response,
): Promise<void> {
  const admin = await getAdminContact(req.user.userId);
  const name =
    `${admin?.firstname || ""} ${admin?.lastname || ""}`.trim() ||
    "an administrator";
  const markdown = await handoverMarkdown(name);
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": `attachment; filename="absolutecare-handover-${date}.md"`,
    "Cache-Control": "no-store",
  });
  res.send(markdown);
}

export async function getIntegrationHealth(
  req: Request,
  res: Response,
): Promise<void> {
  const settings = await getSettings();
  const [google, recaptcha, calendar, email] = await Promise.all([
    integrationResponse("googleAuth", settings),
    integrationResponse("recaptcha", settings),
    integrationResponse("googleCalendar", settings),
    integrationResponse("email", settings),
  ]);
  res.set("Cache-Control", "no-store");
  // Same record shape the cards render, so "Re-check status" updates every
  // field instead of only the configured flag.
  res.json({
    google: { ...google, ...healthFor("google") },
    recaptcha: { ...recaptcha, ...healthFor("recaptcha") },
    calendar: { ...calendar, ...healthFor("calendar") },
    email: { ...email, ...getMailerHealth() },
  });
}
