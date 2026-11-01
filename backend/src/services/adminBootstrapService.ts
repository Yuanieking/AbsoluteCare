import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { ADMIN_EMAILS } from "../config/env.js";
import UserModel, { type UserDoc } from "../models/userModel.js";
import { normalizeEmail } from "../utils/validators.js";

const BOOTSTRAP_ACTION = "admin_bootstrapped";

const bootstrapEmails = new Set(ADMIN_EMAILS);

export function isBootstrapAdminEmail(email: string): boolean {
  return bootstrapEmails.has(normalizeEmail(email));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function nameFromEmail(email: string): { firstname: string; lastname: string } {
  const [firstname = "", ...rest] = (email.split("@")[0] || "")
    .split(/[._-]+/)
    .filter(Boolean);
  return {
    firstname: titleCase(firstname) || "Clinic",
    lastname: rest.map(titleCase).join(" ") || "Admin",
  };
}

/**
 * Makes the account for `email` an active admin, creating it when the address
 * has never signed in. The allowlist is enforced every time this runs, so a
 * manual demotion or deactivation of a bootstrap admin is reverted on the next
 * boot or Google sign-in.
 */
export async function ensureBootstrapAdmin(email: string): Promise<UserDoc> {
  const normalized = normalizeEmail(email);
  if (!bootstrapEmails.has(normalized)) {
    throw new Error(`${normalized} is not an ADMIN_EMAILS address.`);
  }
  const existing = await UserModel.findOne({ email: normalized });
  if (existing) {
    const changed =
      existing.role !== "admin" ||
      !existing.isActive ||
      existing.isArchived ||
      Boolean(existing.removedAt);
    if (changed) {
      existing.role = "admin";
      existing.isActive = true;
      existing.isArchived = false;
      existing.removedAt = null;
      existing.accountAudit.push({
        action: BOOTSTRAP_ACTION,
        by: null,
        at: new Date(),
      });
      await existing.save();
      console.log(`bootstrap: promoted ${normalized} to admin`);
    }
    return existing;
  }
  const created = await UserModel.create({
    ...nameFromEmail(normalized),
    email: normalized,
    // Passwordless by design: Google is the sign-in path, so the stored hash is
    // unguessable. The owner can still set a password through a reset link.
    password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
    authProvider: "google",
    role: "admin",
    isActive: true,
    acceptedTerms: true,
    termsAcceptedAt: new Date(),
    accountAudit: [{ action: "created" }, { action: BOOTSTRAP_ACTION }],
  });
  console.log(`bootstrap: created admin ${normalized}`);
  return created;
}

export async function syncBootstrapAdmins(): Promise<void> {
  for (const email of ADMIN_EMAILS) {
    try {
      await ensureBootstrapAdmin(email);
    } catch (error) {
      console.error(
        `bootstrap: cannot prepare admin ${email}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
