import User from "../models/userModel.js";
import Dependent from "../models/dependentModel.js";
import Appointment from "../models/appointmentModel.js";
import Session from "../models/sessionModel.js";
import TherapyService from "../models/therapyServiceModel.js";
import AppSetting from "../models/appSettingModel.js";
import RecordEditors from "../models/recordEditorsModel.js";
import { ForbiddenError, NotFoundError } from "../errors/AppError.js";
import { getSettings, roleAccess } from "./settingsService.js";

export const EDITOR_TTL_MS = 45_000;
const models = { users: User, dependents: Dependent, appointments: Appointment,
  sessions: Session, services: TherapyService, settings: AppSetting };

export async function authorizeRecordEditor(actor, kind, id) {
  if (id === "singleton" && kind !== "settings") throw new NotFoundError("Record not found.");
  const record = await models[kind].findOne(kind === "settings" ? { key: "singleton" } : { _id: id }).lean();
  if (!record) throw new NotFoundError("Record not found.");
  const own = (value) => String(value) === String(actor.userId);
  if (actor.role === "admin" || (kind === "users" && own(record._id))) return;
  if (kind === "dependents" && own(record.guardian)) return;
  if (kind === "appointments" && actor.role === "user" && own(record.patient)) return;
  if (actor.role === "user") throw new ForbiddenError("You cannot edit this record.");
  const areas = { users: ["patients", "userManagement"], appointments: ["appointments", "payments"], services: ["services"] };
  const permissions = roleAccess(await getSettings())[actor.role];
  const allowed = (area, action = "update") => permissions?.[area]?.read && permissions?.[area]?.[action];
  if (actor.role === "therapist" && own(record.therapist)) {
    if (kind === "sessions" && allowed("sessions")) return;
    if (kind === "appointments" && (allowed("appointments") || allowed("sessions", "create"))) return;
  }
  if (kind === "users") {
    if (allowed("userManagement") || (["user", "therapist"].includes(record.role) && allowed("patients"))) return;
  } else if ((areas[kind] || []).some((area) => allowed(area))) return;
  throw new ForbiddenError("You cannot edit this record.");
}

export function visibleEditors(entries, now = new Date()) {
  const users = new Map();
  for (const entry of entries || []) {
    if (new Date(entry.lastSeenAt).getTime() <= now.getTime() - EDITOR_TTL_MS) continue;
    const id = String(entry.userId);
    const previous = users.get(id);
    if (!previous || new Date(previous.lastSeenAt) < new Date(entry.lastSeenAt))
      users.set(id, { userId: id, name: entry.name, lastSeenAt: entry.lastSeenAt });
  }
  return [...users.values()];
}

export async function updateRecordEditors(actor, kind, id, sessionId, leave = false, retry = true) {
  await authorizeRecordEditor(actor, kind, id);
  const key = `${kind}:${id}`;
  const now = new Date();
  const cutoff = new Date(now.getTime() - EDITOR_TTL_MS);
  if (leave) {
    const result = await RecordEditors.findOneAndUpdate({ _id: key }, {
      $pull: { activeEditors: { userId: actor.userId, sessionId } },
    }, { new: true }).lean();
    return visibleEditors(result?.activeEditors, now);
  }
  const user = await User.findById(actor.userId).select("firstname lastname").lean();
  const entry = { userId: user._id, sessionId,
    name: `${user.firstname || ""} ${user.lastname || ""}`.trim() || "User", lastSeenAt: now };
  // One pipeline keeps concurrent heartbeats from replacing another editor's entry.
  let result;
  try {
    result = await RecordEditors.findOneAndUpdate({ _id: key }, [{ $set: {
      activeEditors: { $concatArrays: [{ $filter: {
        input: { $ifNull: ["$activeEditors", []] }, as: "editor", cond: { $and: [
          { $gt: ["$$editor.lastSeenAt", cutoff] },
          { $not: [{ $and: [{ $eq: ["$$editor.userId", user._id] }, { $eq: ["$$editor.sessionId", sessionId] }] }] },
        ] },
      } }, { $literal: [entry] }] },
      expiresAt: new Date(now.getTime() + EDITOR_TTL_MS),
    } }], { new: true, upsert: true, updatePipeline: true }).lean();
  } catch (error) {
    if (error.code !== 11000 || !retry) throw error;
    return updateRecordEditors(actor, kind, id, sessionId, leave, false);
  }
  return visibleEditors(result.activeEditors, now);
}
