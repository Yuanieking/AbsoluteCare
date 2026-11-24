import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";
import { AppError, ConflictError } from "../errors/AppError.js";
import { parseIfMatch } from "./concurrencyService.js";

export const recordWriteContext = new AsyncLocalStorage();
export const EDITOR_TTL_MS = 45_000;

// The earliest live editor session holds the edit lock; entries older than joinedAt fall back to lastSeenAt.
export function editorHolder(entries, now = new Date()) {
  const joined = (entry) => new Date(entry.joinedAt || entry.lastSeenAt).getTime();
  return (entries || [])
    .filter((entry) => new Date(entry.lastSeenAt).getTime() > now.getTime() - EDITOR_TTL_MS)
    .sort((a, b) => joined(a) - joined(b) || String(a.sessionId).localeCompare(String(b.sessionId)))[0] || null;
}

const editorKinds = { User: "users", Dependent: "dependents", Appointment: "appointments",
  Session: "sessions", TherapyService: "services", AppSetting: "settings" };

async function assertNotLocked(model, id, context) {
  if (context.lockChecked) return;
  // Looked up lazily: importing the model here would compile models before this global plugin is registered.
  const doc = await mongoose.models.RecordEditors?.findById(`${editorKinds[model]}:${model === "AppSetting" ? "singleton" : id}`).lean();
  const holder = editorHolder(doc?.activeEditors);
  if (holder && holder.sessionId !== context.editorSession)
    throw new AppError(409, { code: "RECORD_LOCKED", message: `${holder.name} is editing this record. Try again when they finish.` });
  context.lockChecked = true;
}

export function recordTarget(path, method) {
  if (!["PATCH", "PUT", "DELETE", "POST"].includes(method)) return null;
  path = path.replace(/^\/api\/v1(?=\/|$)/, "");
  if (/^\/(?:auth\/(?:profile|notification-preferences)|therapist\/(?:profile|availability)|secretary\/profile)$/.test(path)) return "User:self";
  if (/^\/(?:admin\/)?settings\/(?:general|auth|booking|schedule|notifications|payments|system|maintenance|integrations\/[^/]+|integrations\/credentials\/(?:reset|[^/]+\/(?:clear|rollback)))$/.test(path)) return "AppSetting:singleton";
  const match = /^\/(?:admin\/|therapist\/|secretary\/)?(users|patients|therapists|dependents|appointments|sessions|services)\/([a-f\d]{24})(?:\/(.*))?$/i.exec(path);
  if (!match) return null;
  if (method === "POST" && !/^(?:cancel|reschedule-request|payment|session|sessions)$/.test(match[3] || "")) return null;
  return `${({ users: "User", patients: "User", therapists: "User", dependents: "Dependent", appointments: "Appointment", sessions: "Session", services: "TherapyService" })[match[1]]}:${match[2]}`;
}

export function requireRecordTimestamp(header) {
  const expected = parseIfMatch(header);
  if (!expected) throw new AppError(428, { code: "PRECONDITION_REQUIRED", message: "Reload this record before saving. A record timestamp is required." });
  return expected;
}

// Scoped to the record targeted by an HTTP edit. Jobs and unrelated side effects stay unchanged.
export function recordConcurrencyPlugin(schema) {
  function expectedFor(model, id) {
    const context = recordWriteContext.getStore();
    if (!context?.target || !context.target.startsWith(`${model}:`)) return null;
    const targetId = context.target.split(":")[1];
    if (id && !["singleton", "self"].includes(targetId) && targetId !== String(id)) return null;
    return { context, expected: context.savedAt || requireRecordTimestamp(context.ifMatch) };
  }
  schema.post("init", function (doc) { doc.$locals.recordTimestamp = doc.updatedAt; });
  schema.pre("save", async function () {
    if (this.isNew) return;
    const guard = expectedFor(this.constructor.modelName, this._id);
    if (!guard) return;
    const { context, expected } = guard;
    await assertNotLocked(this.constructor.modelName, this._id, context);
    const original = this.$locals.recordTimestamp || this.updatedAt;
    // Existing guardFresh pins the original timestamp before Mongoose's timestamp hook runs.
    const loaded = this.$where?.updatedAt || original;
    if (new Date(loaded).getTime() !== expected.getTime()) throw new ConflictError();
    this.$where = { ...this.$where, updatedAt: expected };
    this.updatedAt = new Date(Math.max(Date.now(), expected.getTime() + 1));
    this.$locals.recordWriteContext = context;
  });
  schema.post("save", function (doc) {
    doc.$locals.recordTimestamp = doc.updatedAt;
    if (doc.$locals.recordWriteContext) doc.$locals.recordWriteContext.savedAt = doc.updatedAt;
  });
  schema.pre(["findOneAndUpdate", "updateOne", "deleteOne", "findOneAndDelete"], async function () {
    const guard = expectedFor(this.model.modelName, this.getFilter()._id);
    if (!guard) return;
    const { context, expected } = guard;
    await assertNotLocked(this.model.modelName, this.getFilter()._id, context);
    this.setQuery({ ...this.getFilter(), updatedAt: expected,
      ...(this.model.modelName === "AppSetting" ? context.lease
        ? { editLease: context.lease, editLeaseExpiresAt: { $gt: new Date() } }
        : { $or: [{ editLease: null }, { editLeaseExpiresAt: { $lt: new Date() } }] } : {}),
    });
    this.setOptions({ upsert: false });
    if (!this.op.toLowerCase().includes("delete")) {
      const update = this.getUpdate();
      update.$set = { ...update.$set, updatedAt: new Date(Math.max(Date.now(), expected.getTime() + 1)) };
      this.setUpdate(update);
      context.pendingTimestamp = update.$set.updatedAt;
    }
  });
  schema.post(["findOneAndUpdate", "updateOne", "deleteOne", "findOneAndDelete"], function (result) {
    const guard = expectedFor(this.model.modelName, this.getFilter()._id);
    if (!guard) return;
    if (!result || result.matchedCount === 0 || result.deletedCount === 0) throw new ConflictError();
    guard.context.savedAt = guard.context.pendingTimestamp;
  });
}
