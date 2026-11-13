import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";

const STATIC_ACTIONS = new Set([
  "disable_google_auth",
  "disable_recaptcha",
  "disableGoogleAuth",
  "disableRecaptcha",
]);

const CREDENTIAL_ACTION =
  /^(rotateIntegrationCredentials|clearIntegrationCredential|rollbackIntegrationCredential):([A-Za-z0-9_]+)$/;

export function parseAction(action) {
  const value = String(action || "");
  if (STATIC_ACTIONS.has(value)) return { action: value, kind: "toggle" };
  const match = CREDENTIAL_ACTION.exec(value);
  if (!match) return null;
  const kind =
    match[1] === "rotateIntegrationCredentials"
      ? "rotate"
      : match[1] === "clearIntegrationCredential"
        ? "clear"
        : "rollback";
  const target = match[2];
  return target ? { action: value, kind, target } : { action: value, kind };
}

export function trimValues(values) {
  return Object.fromEntries(
    Object.entries(values ?? {})
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, String(value).trim()]),
  );
}

export function verifySettingsToken(adminId, action, token) {
  try {
    const payload = jwt.verify(String(token || ""), JWT_SECRET);
    return payload.purpose === "settings-verification" &&
      payload.adminId === adminId &&
      payload.action === action
      ? payload
      : null;
  } catch {
    return null;
  }
}
