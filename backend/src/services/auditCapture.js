import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import AuditLog from "../models/auditLogModel.js";

export const auditContext = new AsyncLocalStorage();
export const AUDIT_CATEGORIES = {
  User: "account",
  Dependent: "patient",
  Appointment: "appointment",
  Session: "session",
  TherapyService: "service",
  Specialization: "service",
  GeneratedDocument: "document",
  AppSetting: "settings",
  IntegrationCredential: "integration",
  GoogleDriveConnection: "integration",
  Notification: "notification",
  SettingsAuditLog: "settings",
};
const ignored =
  /^(?:_id|__v|createdAt|updatedAt|accountAudit|auditLog|paymentAudit|editHistory)(?:\.|$)/;

function plain(value) {
  if (value?.toObject) return value.toObject({ depopulate: true });
  return value;
}
function normalized(value) {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (value && typeof value === "object" && value._id) return String(value._id);
  return value;
}
// Audit entries keep every value; only raw binary (generated PDFs) is summarized to stay under the document size limit.
function auditValue(value) {
  if (Buffer.isBuffer(value)) return `[binary ${value.length} bytes]`;
  return normalized(value);
}
function flatten(value, prefix = "", result = {}) {
  for (const [key, item] of Object.entries(plain(value) || {})) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (ignored.test(field)) continue;
    if (Array.isArray(item) || Buffer.isBuffer(item))
      result[field] = item;
    else if (
      item &&
      typeof item === "object" &&
      !(item instanceof Date) &&
      !(item instanceof mongoose.Types.ObjectId)
    )
      flatten(item, field, result);
    else result[field] = normalized(item);
  }
  return result;
}
export function auditChanges(before, after) {
  const old = flatten(before),
    next = flatten(after);
  return [...new Set([...Object.keys(old), ...Object.keys(next)])]
    .filter(
      (field) => JSON.stringify(old[field]) !== JSON.stringify(next[field]),
    )
    .map((field) => ({
      field: field.slice(0, 160),
      before: auditValue(old[field]),
      after: auditValue(next[field]),
    }));
}
function subjects(model, doc) {
  const value = plain(doc) || {};
  const ids =
    model === "User"
      ? [value._id]
      : [value.patient, value.guardian, value.user];
  return ids
    .map((id) => id?._id || id)
    .filter((id) => mongoose.isObjectIdOrHexString(id));
}
export async function recordChange(model, before, after, operation, session) {
  if (model === "SettingsAuditLog") {
    const row = plain(after);
    if (!row) return;
    const context = auditContext.getStore() || {};
    await AuditLog.create(
      [
        {
          _id: `settings:${row._id}`,
          at: row.createdAt || new Date(),
          actorId: context.actor?.actorId || row.admin,
          actorName: context.actor?.actorName || "Admin",
          actorRole: "admin",
          category:
            row.section === "backup"
              ? "backup"
              : row.section === "integrationCredentials"
                ? "integration"
                : "settings",
          action: `${row.section}.${row.field}`,
          resourceType: "AppSetting",
          resourceId: "singleton",
          changes: auditChanges(
            { [row.field]: row.oldValue },
            { [row.field]: row.newValue },
          ),
          source: "live",
          requestId: context.requestId || "",
        },
      ],
      session ? { session } : {},
    );
    return;
  }
  const changes = operation === "failed" ? [] : auditChanges(before, after);
  if (!changes.length && operation === "update") return;
  const context = auditContext.getStore() || {};
  const category =
    model === "Appointment" &&
    changes.some((change) => change.field.startsWith("payment."))
      ? "payment"
      : AUDIT_CATEGORIES[model];
  const doc = plain(after) || plain(before) || {};
  await AuditLog.create(
    [
      {
        _id: randomUUID(),
        at: new Date(),
        ...context.actor,
        category,
        action: `${model}.${operation}`,
        resourceType: model,
        resourceId: String(doc._id || ""),
        changes,
        result: operation === "failed" ? "failure" : "success",
        subjects: [
          ...new Set(
            [...subjects(model, before), ...subjects(model, after)].map(String),
          ),
        ],
        requestId: context.requestId || "",
        source: context.actor ? "live" : "system",
      },
    ],
    session ? { session } : {},
  );
}

// Registered before models compile. The plugin covers every current persistence
// path: save/create, query writes, insertMany and bulkWrite, including jobs.
export function auditPlugin(schema) {
  function tracked(model) {
    return Boolean(AUDIT_CATEGORIES[model.modelName]);
  }
  schema.pre("save", async function () {
    if (!tracked(this.constructor)) return;
    this.$locals.auditBefore = this.isNew
      ? null
      : await this.constructor
          .findById(this._id)
          .session(this.$session())
          .lean();
    this.$locals.auditOperation = this.isNew ? "create" : "update";
  });
  schema.post("save", function (error, doc, next) {
    if (!doc || !tracked(doc.constructor)) return next(error);
    recordChange(
      doc.constructor.modelName,
      null,
      { _id: doc._id },
      "failed",
      null,
    ).then(() => next(error), next);
  });
  schema.post("save", async function (doc) {
    if (!tracked(doc.constructor)) return;
    await recordChange(
      doc.constructor.modelName,
      doc.$locals.auditBefore,
      doc,
      doc.$locals.auditOperation,
      doc.$session(),
    );
  });
  const writes = [
    "findOneAndUpdate",
    "updateOne",
    "updateMany",
    "findOneAndDelete",
    "deleteOne",
    "deleteMany",
    "replaceOne",
    "findOneAndReplace",
  ];
  for (const operation of writes) {
    schema.pre(operation, { query: true, document: false }, async function () {
      if (!tracked(this.model)) return;
      const query = this.model
        .find(this.getFilter())
        .session(this.getOptions().session || null);
      if (!["updateMany", "deleteMany"].includes(operation)) query.limit(1);
      this.auditBefore = await query.lean();
    });
    schema.post(
      operation,
      { query: true, document: false },
      function (error, result, next) {
        if (!tracked(this.model)) return next(error);
        recordChange(
          this.model.modelName,
          null,
          { _id: this.getFilter()._id },
          "failed",
          null,
        ).then(() => next(error), next);
      },
    );
    schema.post(
      operation,
      { query: true, document: false },
      async function (result) {
        if (!tracked(this.model)) return;
        const session = this.getOptions().session;
        if (operation.startsWith("findOneAnd") && result == null) return;
        const removing = /Delete|delete/.test(operation);
        if (
          (removing && result?.deletedCount === 0) ||
          (!removing && result?.matchedCount === 0 && !result?.upsertedId)
        )
          return;
        for (const before of this.auditBefore || []) {
          const after = removing
            ? null
            : await this.model
                .findById(before._id)
                .session(session || null)
                .lean();
          await recordChange(
            this.model.modelName,
            before,
            after,
            removing ? "delete" : "update",
            session,
          );
        }
        if (
          !this.auditBefore?.length &&
          !removing &&
          this.getOptions().upsert
        ) {
          const id = result?.upsertedId || result?._id;
          const after = id
            ? await this.model
                .findById(id)
                .session(session || null)
                .lean()
            : await this.model
                .findOne(this.getFilter())
                .session(session || null)
                .lean();
          if (after)
            await recordChange(
              this.model.modelName,
              null,
              after,
              "create",
              session,
            );
        }
      },
    );
  }
  schema.post("insertMany", async function (docs) {
    if (!tracked(this)) return;
    for (const doc of docs)
      await recordChange(this.modelName, null, doc, "create", null);
  });
  schema.post("bulkWrite", async function (result) {
    if (!tracked(this)) return;
    if (
      result.modifiedCount ||
      result.upsertedCount ||
      result.deletedCount ||
      result.insertedCount
    ) {
      await recordChange(
        this.modelName,
        null,
        { status: "bulk-write-completed" },
        "bulk-update",
        null,
      );
    }
  });
}
