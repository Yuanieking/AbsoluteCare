import crypto from "node:crypto";
import {
  CREDENTIAL_ENCRYPTION_KEY,
  GOOGLE_CALENDAR_ENCRYPTION_KEY,
  JWT_SECRET,
} from "../config/env.js";

const KEY_MATERIAL =
  CREDENTIAL_ENCRYPTION_KEY || GOOGLE_CALENDAR_ENCRYPTION_KEY || JWT_SECRET;

const appKey = crypto.createHash("sha256").update(KEY_MATERIAL).digest();

export function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", appKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload, onFailure) {
  if (!payload) return null;
  try {
    const [ivHex, tagHex, dataHex] = String(payload).split(":");
    if (!ivHex || !tagHex || !dataHex) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      appKey,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    onFailure?.();
    return null;
  }
}
