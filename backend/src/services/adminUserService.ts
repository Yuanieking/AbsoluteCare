import type { QueryFilter, Types } from "mongoose";
import User, {
  type AccountAuditEntry,
  type User as UserRecord,
  type UserDoc,
  type UserRole,
} from "../models/userModel.js";

export type AdminUserDoc = UserDoc;
export type AdminUserRole = UserRole;

const selectFields = "-password";

function auditEntry(action: string, adminId: string): AccountAuditEntry {
  // `by` arrives as a string JWT claim; Mongoose casts it on save.
  return {
    action,
    by: adminId as unknown as Types.ObjectId,
  } as AccountAuditEntry;
}

export interface UserListFilters {
  role?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

export async function listUsers(
  filters: UserListFilters,
): Promise<{ users: UserDoc[]; total: number }> {
  // Query params are unvalidated today; Mongoose casts these filters.
  const query = { removedAt: null } as QueryFilter<UserRecord>;
  const role = filters.role;
  if (role && role !== "all")
    query.role = (role === "patient" ? "user" : role) as UserRole;
  if (filters.status === "active") {
    query.isActive = true;
    query.isArchived = false;
  }
  if (filters.status === "deactivated") {
    query.isActive = false;
    query.isArchived = false;
  }
  if (filters.status === "pending") {
    query.isActive = false;
    query.isArchived = false;
    if (!query.role) query.role = { $ne: "user" };
  }
  if (filters.status === "archived") query.isArchived = true;
  const search = filters.search?.trim();
  if (search) {
    query.$or = [
      { firstname: { $regex: search, $options: "i" } },
      { lastname: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { specialization: { $regex: search, $options: "i" } },
    ] as QueryFilter<UserRecord>[];
  }
  const [users, total] = await Promise.all([
    User.find(query)
      .select(selectFields)
      .populate("accountAudit.by", "firstname lastname email")
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit),
    User.countDocuments(query),
  ]);
  return { users, total };
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  return User.findById(id);
}

export async function findUserWithAudit(id: string): Promise<UserDoc | null> {
  const user = await User.findById(id)
    .select(selectFields)
    .populate("accountAudit.by", "firstname lastname email");
  // mongoose 9 drops instance-method typing on .select(); the doc has them.
  return user as unknown as UserDoc | null;
}

export async function findRoleRecord(
  id: string,
  role: UserRole,
): Promise<UserDoc | null> {
  const user = await User.findOne({ _id: id, role })
    .select(selectFields)
    .populate("accountAudit.by", "firstname lastname email");
  return user as unknown as UserDoc | null;
}

export async function emailExists(
  email: string,
  excludeId?: Types.ObjectId | string,
): Promise<boolean> {
  const query: QueryFilter<UserRecord> = { email };
  if (excludeId) query._id = { $ne: excludeId };
  return Boolean(await User.exists(query));
}

export interface CreateUserAccountInput {
  fields: Record<string, unknown>;
  firstname: string;
  lastname: string;
  email: string;
  role: UserRole;
  password: string;
  mustChangePassword: boolean;
  adminId: string;
}

export async function createUserAccount(
  input: CreateUserAccountInput,
): Promise<UserDoc> {
  // Body fields are unvalidated today; the schema validates them at runtime.
  const user = await User.create({
    ...input.fields,
    firstname: input.firstname,
    lastname: input.lastname,
    email: input.email,
    role: input.role,
    password: input.password,
    mustChangePassword: input.mustChangePassword,
    authProvider: "local",
    accountAudit: [{ action: "created", by: input.adminId }],
  } as unknown as Partial<UserRecord>);
  return user as UserDoc;
}

export async function applyAccountUpdate(
  user: UserDoc,
  updates: Record<string, unknown>,
  auditAction: string,
  adminId: string,
): Promise<UserDoc> {
  Object.assign(user, updates);
  user.accountAudit.push(auditEntry(auditAction, adminId));
  await user.save();
  return user;
}

export async function setUserActive(
  user: UserDoc,
  isActive: boolean,
  adminId: string,
): Promise<UserDoc> {
  user.isActive = isActive;
  user.accountAudit.push(
    auditEntry(isActive ? "activated" : "deactivated", adminId),
  );
  await user.save();
  return user;
}

export async function archiveUserAccount(
  user: UserDoc,
  adminId: string,
): Promise<UserDoc> {
  user.isArchived = true;
  user.isActive = false;
  user.accountAudit.push(auditEntry("archived", adminId));
  await user.save();
  return user;
}

export async function removeUserAccount(
  user: UserDoc,
  adminId: string,
): Promise<UserDoc> {
  user.removedAt = new Date();
  user.isActive = false;
  user.accountAudit.push(auditEntry("removed", adminId));
  await user.save();
  return user;
}

export type RoleRecordUpdate =
  | { status: "not_found" }
  | { status: "email_taken" }
  | { status: "updated"; user: UserDoc };

export async function updateRoleRecord(params: {
  id: string;
  role: UserRole;
  updates: Record<string, unknown>;
  adminId: string;
}): Promise<RoleRecordUpdate> {
  const user = await User.findOne({ _id: params.id, role: params.role });
  if (!user) return { status: "not_found" };
  const updates = { ...params.updates };
  if (updates.email) {
    const email = (updates.email as string).trim().toLowerCase();
    updates.email = email;
    if (await User.exists({ email, _id: { $ne: user._id } })) {
      return { status: "email_taken" };
    }
  }
  Object.assign(user, updates);
  user.accountAudit.push(auditEntry("updated", params.adminId));
  await user.save();
  return { status: "updated", user };
}
