import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { sendEmail } from "../services/mailer.js";
import { staffInvitation } from "../emails/templates/index.js";
import { getSettings } from "../services/settingsService.js";
import {
  availabilitySchema,
  normalizeAvailability,
} from "../schemas/availabilitySchema.js";
import {
  findConflicts,
  saveAvailability,
  scheduleConflictPayload,
  scheduleOf,
} from "../services/availabilityService.js";
import * as adminUserService from "../services/adminUserService.js";
import type {
  AdminUserDoc,
  AdminUserRole,
} from "../services/adminUserService.js";
import { guardFresh } from "../services/concurrencyService.js";

const roles = ["user", "therapist", "secretary", "admin"] as const;

function publicRole(role: AdminUserRole | string): string {
  return role === "user" ? "patient" : role;
}

function userResponse(user: AdminUserDoc): Record<string, unknown> {
  const value = user.toObject() as unknown as Record<string, unknown>;
  delete value.password;
  if (user.role === "therapist") value.workingHoursByDay = scheduleOf(user);
  return { ...value, role: publicRole(user.role) };
}

function cleanFields(
  body: Record<string, unknown>,
  includeEmail = true,
): Record<string, unknown> {
  const fields = [
    "firstname",
    "lastname",
    "phone",
    "profilePicture",
    "specialization",
    "workingDays",
    "workingHours",
  ];
  if (includeEmail) fields.push("email");
  return Object.fromEntries(
    fields
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]]),
  );
}

function validateRole(role: unknown): boolean {
  const normalized = role === "patient" ? "user" : role;
  return (
    typeof normalized === "string" &&
    (roles as readonly string[]).includes(normalized)
  );
}

function normalizeRole(role: unknown): AdminUserRole {
  return (role === "patient" ? "user" : role) as AdminUserRole;
}

function normalizeUserFields(
  body: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]]),
  );
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const filters: adminUserService.UserListFilters = {
    page: Math.max(Number(req.query.page as string | undefined) || 1, 1),
    limit: Math.min(
      Math.max(Number(req.query.limit as string | undefined) || 10, 1),
      50,
    ),
  };
  const role = req.query.role as string | undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  if (role !== undefined) filters.role = role;
  if (status !== undefined) filters.status = status;
  if (search !== undefined) filters.search = search;

  const { users, total } = await adminUserService.listUsers(filters);
  res.json({
    users: users.map(userResponse),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  });
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const user = await adminUserService.findUserWithAudit(
    req.params.id as string,
  );
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  res.json({ user: userResponse(user) });
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const role = normalizeRole(body.role);
  if (!validateRole(body.role)) {
    res.status(400).json({ message: "Choose a valid user role." });
    return;
  }
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const firstname = typeof body.firstname === "string" ? body.firstname : "";
  const lastname = typeof body.lastname === "string" ? body.lastname : "";
  if (!firstname.trim() || !lastname.trim() || !email) {
    res
      .status(400)
      .json({ message: "First name, last name, and email are required." });
    return;
  }
  if (await adminUserService.emailExists(email)) {
    res.status(409).json({ message: "Email already in use." });
    return;
  }
  const suppliedPassword = String(body.password || "");
  const minLength = (await getSettings()).auth?.passwordMinLength || 8;
  if (suppliedPassword && suppliedPassword.length < minLength) {
    res
      .status(400)
      .json({ message: `Passwords must be at least ${minLength} characters.` });
    return;
  }
  const temporaryPassword =
    suppliedPassword || crypto.randomBytes(18).toString("base64url");
  const user = await adminUserService.createUserAccount({
    fields: cleanFields(body),
    firstname: firstname.trim(),
    lastname: lastname.trim(),
    email,
    role,
    password: await bcrypt.hash(temporaryPassword, 10),
    mustChangePassword: role !== "user",
    adminId: req.user.userId,
  });
  void staffInvitation({
    email,
    firstname: user.firstname,
    lastname: user.lastname,
    role: publicRole(role),
    temporaryPassword,
  })
    .then(sendEmail)
    .catch((error: unknown) =>
      console.error(
        "Staff invitation email rendering failed:",
        (error as Error).message,
      ),
    );
  res.status(201).json({
    user: userResponse(user),
    temporaryPassword,
    message: `Account created for ${email}.`,
  });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const existing = await adminUserService.findUserById(req.params.id as string);
  if (!existing) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  // ** Concurrency: reject if the user changed since the client read it.
  guardFresh(existing, req.get("If-Match"));
  const roleChanging = body.role !== undefined;
  const nextRole = normalizeRole(body.role);
  if (roleChanging && !validateRole(body.role)) {
    res.status(400).json({ message: "Choose a valid user role." });
    return;
  }
  if (roleChanging && existing._id.toString() === req.user.userId) {
    res.status(400).json({ message: "You cannot change your own role." });
    return;
  }
  const finalRole = roleChanging ? nextRole : existing.role;
  const updates = cleanFields(body);
  if (updates.email) {
    updates.email = String(updates.email).trim().toLowerCase();
    if (
      await adminUserService.emailExists(updates.email as string, existing._id)
    ) {
      res.status(409).json({ message: "Email already in use." });
      return;
    }
  }
  if (roleChanging) updates.role = nextRole;
  if (finalRole !== "therapist") {
    updates.specialization = "";
    updates.workingDays = [];
  }
  const previousRole = existing.role;
  const auditAction =
    roleChanging && previousRole !== finalRole
      ? `role-changed:${previousRole}→${finalRole}`
      : "updated";
  await adminUserService.applyAccountUpdate(
    existing,
    updates,
    auditAction,
    req.user.userId,
  );
  res.json({ user: userResponse(existing) });
}

async function setActive(
  req: Request,
  res: Response,
  isActive: boolean,
): Promise<void> {
  const user = await adminUserService.findUserById(req.params.id as string);
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  // ** Concurrency: reject if the user changed since the client read it.
  guardFresh(user, req.get("If-Match"));
  if (user._id.toString() === req.user.userId) {
    res
      .status(400)
      .json({ message: "You cannot change your own account status." });
    return;
  }
  if (user.removedAt) {
    res.status(409).json({ message: "This account has been removed." });
    return;
  }
  await adminUserService.setUserActive(user, isActive, req.user.userId);
  res.json({
    user: userResponse(user),
    message: isActive ? "User activated." : "User deactivated.",
  });
}

export const deactivateUser = (req: Request, res: Response): Promise<void> =>
  setActive(req, res, false);

export const activateUser = (req: Request, res: Response): Promise<void> =>
  setActive(req, res, true);

export async function archiveUser(req: Request, res: Response): Promise<void> {
  const user = await adminUserService.findUserById(req.params.id as string);
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  // ** Concurrency: reject if the user changed since the client read it.
  guardFresh(user, req.get("If-Match"));
  if (user._id.toString() === req.user.userId) {
    res.status(400).json({ message: "You cannot archive your own account." });
    return;
  }
  await adminUserService.archiveUserAccount(user, req.user.userId);
  res.json({ user: userResponse(user), message: "User archived." });
}

export async function removeUser(req: Request, res: Response): Promise<void> {
  const user = await adminUserService.findUserById(req.params.id as string);
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  // ** Concurrency: reject if the user changed since the client read it.
  guardFresh(user, req.get("If-Match"));
  if (user._id.toString() === req.user.userId) {
    res.status(400).json({ message: "You cannot remove your own account." });
    return;
  }
  const confirmation = String(
    (req.body as Record<string, unknown>).confirmName || "",
  )
    .trim()
    .toLowerCase();
  const name = `${user.firstname} ${user.lastname}`.trim().toLowerCase();
  if (confirmation !== name) {
    res
      .status(400)
      .json({ message: "Type the user's full name to confirm removal." });
    return;
  }
  await adminUserService.removeUserAccount(user, req.user.userId);
  res.json({ user: userResponse(user), message: "User removed." });
}

async function updateRoleRecord(
  req: Request,
  res: Response,
  role: AdminUserRole,
  fields: string[],
  bodyOverride?: Record<string, unknown>,
): Promise<void> {
  const body = bodyOverride ?? (req.body as Record<string, unknown>);
  const result = await adminUserService.updateRoleRecord({
    id: req.params.id as string,
    role,
    updates: normalizeUserFields(body, fields),
    adminId: req.user.userId,
    // ** Concurrency: guarded inside the service (stale -> 409 STALE_RECORD).
    ifMatch: req.get("If-Match"),
  });
  if (result.status === "not_found") {
    res.status(404).json({
      message: `${role === "user" ? "Patient" : "Therapist"} not found.`,
    });
    return;
  }
  if (result.status === "email_taken") {
    res.status(409).json({ message: "Email already in use." });
    return;
  }
  res.json({ user: userResponse(result.user) });
}

async function getRoleRecord(
  req: Request,
  res: Response,
  role: AdminUserRole,
): Promise<void> {
  const user = await adminUserService.findRoleRecord(
    req.params.id as string,
    role,
  );
  if (!user) {
    res.status(404).json({ message: "Record not found." });
    return;
  }
  res.json({ user: userResponse(user) });
}

export const getPatient = (req: Request, res: Response): Promise<void> =>
  getRoleRecord(req, res, "user");

export const getTherapist = (req: Request, res: Response): Promise<void> =>
  getRoleRecord(req, res, "therapist");

const patientLockedFields = [
  "role",
  "specialization",
  "workingDays",
  "workingHours",
  "workingHoursByDay",
];

export async function updatePatient(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const locked = patientLockedFields.filter((key) => body[key] !== undefined);
  if (locked.length) {
    res.status(400).json({
      message: `${locked.join(", ")} cannot be changed from the patient record.`,
    });
    return;
  }
  return updateRoleRecord(req, res, "user", [
    "firstname",
    "lastname",
    "email",
    "phone",
    "dateOfBirth",
    "address",
    "profilePicture",
  ]);
}

export const updateTherapist = (req: Request, res: Response): Promise<void> =>
  updateRoleRecord(req, res, "therapist", [
    "firstname",
    "lastname",
    "email",
    "phone",
    "profilePicture",
    "address",
  ]);

export async function updateTherapistSpecialization(
  req: Request,
  res: Response,
): Promise<void> {
  const raw = (req.body as Record<string, unknown>).specialization;
  const specialization = Array.isArray(raw)
    ? raw
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  return updateRoleRecord(req, res, "therapist", ["specialization"], {
    specialization,
  });
}

/** Shared by `/admin/users` and `/admin/records` so the contract cannot drift. */
export async function updateTherapistAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = availabilitySchema.parse(req.body);
  const days = normalizeAvailability(
    parsed,
    (req.body as Record<string, unknown>).workingHours as
      | { start?: string; end?: string }
      | undefined,
  );
  const user = await adminUserService.findUserById(req.params.id as string);
  if (!user || user.role !== "therapist") {
    res.status(404).json({ message: "Therapist not found." });
    return;
  }
  // ** Concurrency: reject if the therapist record changed since the client read it.
  guardFresh(user, req.get("If-Match"));
  const conflicts = await findConflicts(user._id.toString(), days);
  if (conflicts.length) {
    res.status(409).json(scheduleConflictPayload(conflicts));
    return;
  }
  await saveAvailability({
    therapist: user,
    days,
    actorId: req.user.userId,
    byAdmin: true,
  });
  res.json({ user: userResponse(user) });
}
