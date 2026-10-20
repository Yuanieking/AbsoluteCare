import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import User from "../models/userModel.js";
import { sendEmail } from "../services/mailer.js";
import { staffInvitation } from "../emails/templates/index.js";

const roles = ["user", "therapist", "secretary"];
const publicRole = (role) => (role === "user" ? "patient" : role);
const selectFields = "-password -accountAudit";

function userResponse(user) {
  const value = user.toObject ? user.toObject() : user;
  return { ...value, role: publicRole(value.role) };
}

function cleanFields(body, includeEmail = true) {
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

function validateRole(role) {
  return roles.includes(role === "patient" ? "user" : role);
}

export async function listUsers(req, res) {
  const query = { removedAt: null };
  const role = req.query.role;
  if (role && role !== "all") query.role = role === "patient" ? "user" : role;
  if (req.query.status === "active") {
    query.isActive = true;
    query.isArchived = false;
  }
  if (req.query.status === "deactivated") {
    query.isActive = false;
    query.isArchived = false;
  }
  if (req.query.status === "archived") query.isArchived = true;
  if (req.query.search?.trim()) {
    const search = req.query.search.trim();
    query.$or = [
      { firstname: { $regex: search, $options: "i" } },
      { lastname: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { specialization: { $regex: search, $options: "i" } },
    ];
  }
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const [users, total] = await Promise.all([
    User.find(query)
      .select(selectFields)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);
  res.json({
    users: users.map(userResponse),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getUser(req, res) {
  const user = await User.findById(req.params.id).select(selectFields);
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user: userResponse(user) });
}

export async function createUser(req, res) {
  const role = req.body.role === "patient" ? "user" : req.body.role;
  if (!validateRole(req.body.role) || role === "admin")
    return res.status(400).json({ message: "Choose a valid user role." });
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  if (!req.body.firstname?.trim() || !req.body.lastname?.trim() || !email)
    return res
      .status(400)
      .json({ message: "First name, last name, and email are required." });
  if (await User.exists({ email }))
    return res.status(409).json({ message: "Email already in use." });
  const suppliedPassword = String(req.body.password || "");
  if (suppliedPassword && suppliedPassword.length < 8)
    return res
      .status(400)
      .json({ message: "Passwords must be at least 8 characters." });
  const temporaryPassword =
    suppliedPassword || crypto.randomBytes(18).toString("base64url");
  const user = await User.create({
    ...cleanFields(req.body),
    firstname: req.body.firstname.trim(),
    lastname: req.body.lastname.trim(),
    email,
    role,
    password: await bcrypt.hash(temporaryPassword, 10),
    mustChangePassword: role !== "user",
    authProvider: "local",
    accountAudit: [{ action: "created", by: req.user.userId }],
  });
  void staffInvitation({
    email,
    firstname: user.firstname,
    lastname: user.lastname,
    role: publicRole(role),
    temporaryPassword,
  })
    .then(sendEmail)
    .catch((error) =>
      console.error("Staff invitation email rendering failed:", error.message),
    );
  res.status(201).json({
    user: userResponse(user),
    temporaryPassword,
    message: `Account created for ${email}.`,
  });
}

export async function updateUser(req, res) {
  const existing = await User.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: "User not found." });
  const nextRole = req.body.role === "patient" ? "user" : req.body.role;
  if (req.body.role !== undefined && !validateRole(req.body.role))
    return res.status(400).json({ message: "Choose a valid user role." });
  const updates = cleanFields(req.body);
  if (updates.email) {
    updates.email = updates.email.trim().toLowerCase();
    if (await User.exists({ email: updates.email, _id: { $ne: existing._id } }))
      return res.status(409).json({ message: "Email already in use." });
  }
  if (req.body.role !== undefined) updates.role = nextRole;
  if (nextRole !== "therapist") {
    updates.specialization = "";
    updates.workingDays = [];
  }
  Object.assign(existing, updates);
  existing.accountAudit.push({ action: "updated", by: req.user.userId });
  await existing.save();
  res.json({ user: userResponse(existing) });
}

async function setActive(req, res, isActive) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user._id.toString() === req.user.userId)
    return res
      .status(400)
      .json({ message: "You cannot change your own account status." });
  if (user.removedAt)
    return res.status(409).json({ message: "This account has been removed." });
  user.isActive = isActive;
  user.accountAudit.push({
    action: isActive ? "activated" : "deactivated",
    by: req.user.userId,
  });
  await user.save();
  res.json({
    user: userResponse(user),
    message: isActive ? "User activated." : "User deactivated.",
  });
}

export const deactivateUser = (req, res) => setActive(req, res, false);
export const activateUser = (req, res) => setActive(req, res, true);

export async function archiveUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user._id.toString() === req.user.userId)
    return res
      .status(400)
      .json({ message: "You cannot archive your own account." });
  user.isArchived = true;
  user.isActive = false;
  user.accountAudit.push({ action: "archived", by: req.user.userId });
  await user.save();
  res.json({ user: userResponse(user), message: "User archived." });
}

export async function removeUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user._id.toString() === req.user.userId)
    return res
      .status(400)
      .json({ message: "You cannot remove your own account." });
  const confirmation = String(req.body.confirmName || "")
    .trim()
    .toLowerCase();
  const name = `${user.firstname} ${user.lastname}`.trim().toLowerCase();
  if (confirmation !== name)
    return res
      .status(400)
      .json({ message: "Type the user's full name to confirm removal." });
  user.removedAt = new Date();
  user.isActive = false;
  user.accountAudit.push({ action: "removed", by: req.user.userId });
  await user.save();
  res.json({ user: userResponse(user), message: "User removed." });
}

function normalizeUserFields(body, fields) {
  return Object.fromEntries(
    fields
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]]),
  );
}

async function updateRoleRecord(req, res, role, fields) {
  const user = await User.findOne({ _id: req.params.id, role });
  if (!user)
    return res.status(404).json({
      message: `${role === "user" ? "Patient" : "Therapist"} not found.`,
    });
  const updates = normalizeUserFields(req.body, fields);
  if (updates.email) {
    updates.email = updates.email.trim().toLowerCase();
    if (await User.exists({ email: updates.email, _id: { $ne: user._id } }))
      return res.status(409).json({ message: "Email already in use." });
  }
  Object.assign(user, updates);
  user.accountAudit.push({ action: "updated", by: req.user.userId });
  await user.save();
  res.json({ user: userResponse(user) });
}

export const getPatient = (req, res) => getRoleRecord(req, res, "user");
export const getTherapist = (req, res) => getRoleRecord(req, res, "therapist");

async function getRoleRecord(req, res, role) {
  const user = await User.findOne({ _id: req.params.id, role }).select(
    selectFields,
  );
  if (!user) return res.status(404).json({ message: "Record not found." });
  res.json({ user: userResponse(user) });
}

export const updatePatient = (req, res) =>
  updateRoleRecord(req, res, "user", [
    "firstname",
    "lastname",
    "email",
    "phone",
    "dateOfBirth",
    "address",
    "profilePicture",
  ]);
export const updateTherapist = (req, res) =>
  updateRoleRecord(req, res, "therapist", [
    "firstname",
    "lastname",
    "email",
    "phone",
    "profilePicture",
    "address",
  ]);

export async function updateTherapistSpecialization(req, res) {
  const specialization = Array.isArray(req.body.specialization)
    ? req.body.specialization
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  return updateRoleRecord(
    { ...req, body: { specialization } },
    res,
    "therapist",
    ["specialization"],
  );
}

export async function updateTherapistAvailability(req, res) {
  const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const { workingDays, workingHours } = req.body;
  if (
    !Array.isArray(workingDays) ||
    workingDays.some((day) => !validDays.includes(day))
  )
    return res.status(400).json({ message: "Choose valid working days." });
  if (
    !workingHours?.start ||
    !workingHours?.end ||
    workingHours.start >= workingHours.end
  )
    return res.status(400).json({
      message: "Working hours must have an end time after the start time.",
    });
  return updateRoleRecord(
    { ...req, body: { workingDays, workingHours } },
    res,
    "therapist",
    ["workingDays", "workingHours"],
  );
}
