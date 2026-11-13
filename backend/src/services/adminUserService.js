import User from "../models/userModel.js";
import { guardFresh } from "./concurrencyService.js";

const selectFields = "-password";

function auditEntry(action, adminId) {
  // `by` arrives as a string JWT claim; Mongoose casts it on save.
  return {
    action,
    by: adminId,
  };
}

export async function listUsers(filters) {
  // Query params are unvalidated today; Mongoose casts these filters.
  const query = { removedAt: null };
  const role = filters.role;
  if (role && role !== "all") query.role = role === "patient" ? "user" : role;
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
    ];
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

export async function findUserById(id) {
  return User.findById(id);
}

export async function findUserWithAudit(id) {
  const user = await User.findById(id)
    .select(selectFields)
    .populate("accountAudit.by", "firstname lastname email");
  // mongoose 9 drops instance-method typing on .select(); the doc has them.
  return user;
}

export async function findRoleRecord(id, role) {
  const user = await User.findOne({ _id: id, role })
    .select(selectFields)
    .populate("accountAudit.by", "firstname lastname email");
  return user;
}

export async function emailExists(email, excludeId) {
  const query = { email };
  if (excludeId) query._id = { $ne: excludeId };
  return Boolean(await User.exists(query));
}

export async function createUserAccount(input) {
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
  });
  return user;
}

export async function applyAccountUpdate(user, updates, auditAction, adminId) {
  Object.assign(user, updates);
  user.accountAudit.push(auditEntry(auditAction, adminId));
  await user.save();
  return user;
}

export async function setUserActive(user, isActive, adminId) {
  user.isActive = isActive;
  user.accountAudit.push(
    auditEntry(isActive ? "activated" : "deactivated", adminId),
  );
  await user.save();
  return user;
}

export async function archiveUserAccount(user, adminId) {
  user.isArchived = true;
  user.isActive = false;
  user.accountAudit.push(auditEntry("archived", adminId));
  await user.save();
  return user;
}

export async function removeUserAccount(user, adminId) {
  user.removedAt = new Date();
  user.isActive = false;
  user.accountAudit.push(auditEntry("removed", adminId));
  await user.save();
  return user;
}

export async function updateRoleRecord(params) {
  const user = await User.findOne({ _id: params.id, role: params.role });
  if (!user) return { status: "not_found" };
  // ** Concurrency: reject if the record changed since the client read it.
  guardFresh(user, params.ifMatch);
  const updates = { ...params.updates };
  if (updates.email) {
    const email = updates.email.trim().toLowerCase();
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
