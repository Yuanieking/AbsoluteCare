import { AsyncLocalStorage } from "node:async_hooks";
import { AppError, ConflictError } from "../errors/AppError.js";
import { parseIfMatch } from "./concurrencyService.js";

export const recordWriteContext = new AsyncLocalStorage();

export function recordTarget(path, method) {
  if (!["PATCH", "PUT", "DELETE", "POST"].includes(method)) return null;
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
  schema.pre("save", function () {
    if (this.isNew) return;
    const guard = expectedFor(this.constructor.modelName, this._id);
    if (!guard) return;
    const { context, expected } = guard;
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
  schema.pre(["findOneAndUpdate", "updateOne", "deleteOne", "findOneAndDelete"], function () {
    const guard = expectedFor(this.model.modelName, this.getFilter()._id);
    if (!guard) return;
    const { context, expected } = guard;
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
