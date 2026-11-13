import {
  CredentialError,
  clearCredential,
  clearDigest,
  credentialGroups,
  digestOf,
  rollbackCredential,
  saveCredentials,
  testGroup,
} from "../services/integrationCredentialService.js";
import { getMailerHealth } from "../services/mailer.js";
import {
  consumeVerification,
  getAdminContact,
} from "../services/settingsService.js";
import {
  parseAction,
  trimValues,
  verifySettingsToken,
} from "../services/verificationActions.js";

function withCredentialErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
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
  };
}

export async function getCredentialGroups(req, res) {
  const groups = await credentialGroups();
  const admin = await getAdminContact(req.user.userId);
  res.json({
    ...groups,
    mail: { ...groups.mail, adminEmail: Boolean(admin?.email) },
  });
}

export const patchCredentials = withCredentialErrors(async (req, res) => {
  const body = req.body ?? {};
  const group = String(body.group ?? "");
  const parsed = parseAction(`rotateIntegrationCredentials:${group}`);
  if (!parsed) {
    res.status(400).json({ message: "Unknown integration." });
    return;
  }

  const trimmed = trimValues(body.values);
  if (!Object.keys(trimmed).length) {
    res.status(400).json({ code: "NO_CHANGES", message: "Enter a new value." });
    return;
  }

  const expected = digestOf(group, trimmed);
  const payload = body.verificationToken
    ? verifySettingsToken(
        req.user.userId,
        parsed.action,
        body.verificationToken,
      )
    : null;
  const bootstrap =
    !payload && group === "email" && getMailerHealth().ok === false;

  if (!payload && !bootstrap) {
    res.status(409).json({
      code: "VERIFICATION_REQUIRED",
      bootstrapAllowed: false,
      message:
        "This change needs a verification code. Request one and try again.",
    });
    return;
  }

  if (payload?.digest && payload.digest !== expected) {
    res.status(400).json({
      code: "DIGEST_MISMATCH",
      message:
        "These values changed after the code was sent. Request a new code.",
    });
    return;
  }

  const result = await saveCredentials({
    group,
    values: trimmed,
    adminId: req.user.userId,
    ip: req.ip ?? "",
    confirmKeyRotation: Boolean(body.confirmKeyRotation),
    bootstrap: Boolean(bootstrap),
  });
  await consumeVerification(payload?.verificationId);
  res.json(result);
});

export const clearCredentialKey = withCredentialErrors(async (req, res) => {
  const key = String(req.params.key ?? "");
  const body = req.body ?? {};
  const payload = verifySettingsToken(
    req.user.userId,
    `clearIntegrationCredential:${key}`,
    body.verificationToken,
  );
  if (!payload) {
    res.status(409).json({
      code: "VERIFICATION_REQUIRED",
      message: "This change needs a verification code.",
    });
    return;
  }
  if (payload.digest && payload.digest !== clearDigest(key)) {
    res.status(400).json({
      code: "DIGEST_MISMATCH",
      message: "Request a new verification code.",
    });
    return;
  }
  const result = await clearCredential({
    key,
    adminId: req.user.userId,
    ip: req.ip ?? "",
  });
  await consumeVerification(payload.verificationId);
  res.json(result);
});

export const rollbackCredentialKey = withCredentialErrors(async (req, res) => {
  const key = String(req.params.key ?? "");
  const body = req.body ?? {};
  const payload = verifySettingsToken(
    req.user.userId,
    `rollbackIntegrationCredential:${key}`,
    body.verificationToken,
  );
  if (!payload) {
    res.status(409).json({
      code: "VERIFICATION_REQUIRED",
      message: "This change needs a verification code.",
    });
    return;
  }
  if (payload.digest && payload.digest !== clearDigest(key)) {
    res.status(400).json({
      code: "DIGEST_MISMATCH",
      message: "Request a new verification code.",
    });
    return;
  }
  const result = await rollbackCredential({
    key,
    adminId: req.user.userId,
    ip: req.ip ?? "",
  });
  await consumeVerification(payload.verificationId);
  res.json(result);
});

export const testCredentialGroup = withCredentialErrors(async (req, res) => {
  const result = await testGroup(String(req.params.group ?? ""));
  res.status(result.ok ? 200 : 502).json(result);
});
