import mongoose from "mongoose";
import AuditLog from "../models/auditLogModel.js";
import { NotFoundError } from "../errors/AppError.js";
import { auditChanges } from "./auditCapture.js";

const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function auditFilter(query, actor) {
  const filter = {};
  if (actor.role !== "admin") {
    filter.actorId = actor.id;
  }
  if (query.category) filter.category = query.category;
  if (query.result) filter.result = query.result;
  if (query.role && actor.role === "admin") filter.actorRole = query.role;
  const clauses = [];
  if (query.actor && actor.role === "admin") {
    if (mongoose.isObjectIdOrHexString(query.actor))
      filter.actorId = query.actor;
    else
      clauses.push({
        actorName: { $regex: escaped(query.actor), $options: "i" },
      });
  }
  if (query.search) {
    const fields =
      actor.role === "admin"
        ? [
            "actorName",
            "action",
            "resourceId",
            "resourceType",
            "category",
            "changes.field",
          ]
        : ["action", "resourceId", "resourceType", "category"];
    clauses.push({
      $or: fields.map((field) => ({
        [field]: { $regex: escaped(query.search), $options: "i" },
      })),
    });
  }
  if (clauses.length) filter.$and = clauses;
  if (query.from || query.to) {
    filter.at = {};
    if (query.from) filter.at.$gte = new Date(`${query.from}T00:00:00+08:00`);
    if (query.to) filter.at.$lte = new Date(`${query.to}T23:59:59.999+08:00`);
  }
  return filter;
}
export function visibleAudit(entry, role) {
  const { subjects, requestId, ...safe } = entry;
  if (role === "admin") return { ...safe, requestId };
  return {
    _id: entry._id,
    at: entry.at,
    category: entry.category,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    result: entry.result,
    source: entry.source,
  };
}
export async function listAudit(query, actor) {
  const filter = auditFilter(query, actor);
  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    entries: entries.map((entry) => visibleAudit(entry, actor.role)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
}
export async function getAudit(id, actor) {
  const row = await AuditLog.findOne({
    ...auditFilter({}, actor),
    _id: id,
  }).lean();
  if (!row) throw new NotFoundError("Audit entry not found.");
  return visibleAudit(row, actor.role);
}
export function csvCell(value) {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+@\-]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
}
export async function* exportAudit(query, actor) {
  yield [
    "Time (Asia/Manila, UTC+08)",
    "Actor",
    "Role",
    "Category",
    "Action",
    "Record",
    "Result",
    "Changes",
  ]
    .map(csvCell)
    .join(",") + "\r\n";
  const cursor = AuditLog.find(auditFilter(query, actor))
    .sort({ at: -1, _id: -1 })
    .lean()
    .cursor();
  const stamp = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Manila",
  });
  try {
    for await (const row of cursor) {
      const entry = visibleAudit(row, actor.role);
      yield [
        stamp.format(entry.at),
        entry.actorName || "",
        entry.actorRole || "",
        entry.category,
        entry.action,
        `${entry.resourceType}:${entry.resourceId}`,
        entry.result,
        JSON.stringify(entry.changes || []),
      ]
        .map(csvCell)
        .join(",") + "\r\n";
    }
  } finally {
    await cursor.close();
  }
}

export async function importLegacyAudit() {
  if (mongoose.connection.readyState !== 1) return;
  const db = mongoose.connection.db;
  if (await AuditLog.exists({ _id: "system:legacy-imported" })) return;
  const migration = await AuditLog.findById("system:legacy-cutoff").lean();
  const cutoff = migration?.at || new Date();
  if (!migration)
    await AuditLog.updateOne(
      { _id: "system:legacy-cutoff" },
      {
        $setOnInsert: {
          at: cutoff,
          category: "settings",
          action: "audit.capture-enabled",
          resourceType: "AuditLog",
          source: "system",
        },
      },
      { upsert: true },
    );
  const descriptors = [
    ["users", "accountAudit", "account", "User", "at", "by"],
    ["appointments", "auditLog", "appointment", "Appointment", "at", "by"],
    ["appointments", "paymentAudit", "payment", "Appointment", "at", "by"],
    ["sessions", "editHistory", "session", "Session", "editedAt", "editedBy"],
    ["therapyservices", "auditLog", "service", "TherapyService", "at", "by"],
  ];
  for (const [
    collection,
    array,
    category,
    model,
    atKey,
    actorKey,
  ] of descriptors) {
    const cursor = db
      .collection(collection)
      .find(
        { [`${array}.0`]: { $exists: true } },
        { projection: { [array]: 1, patient: 1, therapist: 1 } },
      );
    try {
      for await (const doc of cursor) {
        const operations = (doc[array] || [])
          .filter((entry) => entry[atKey] && entry[atKey] < cutoff)
          .map((entry, index) => ({
            updateOne: {
              filter: {
                _id: `legacy:${collection}:${array}:${doc._id}:${entry._id || index}`,
              },
              update: {
                $setOnInsert: {
                  at: entry[atKey],
                  actorId: entry[actorKey] || null,
                  actorName: "Historical actor",
                  actorRole: "system",
                  category,
                  action: `${model}.${entry.action || "updated"}`,
                  resourceType: model,
                  resourceId: String(doc._id),
                  changes: [],
                  subjects:
                    model === "User"
                      ? [doc._id]
                      : [doc.patient].filter(Boolean),
                  source: "legacy",
                  result: "success",
                },
              },
              upsert: true,
            },
          }));
        if (operations.length)
          await AuditLog.bulkWrite(operations, { ordered: false });
      }
    } finally {
      await cursor.close();
    }
  }
  const cursor = db
    .collection("settingsauditlogs")
    .find({ createdAt: { $lt: cutoff } });
  try {
    for await (const row of cursor) {
      await AuditLog.updateOne(
        { _id: `legacy:settings:${row._id}` },
        {
          $setOnInsert: {
            at: row.createdAt,
            actorId: row.admin,
            actorName: "Historical admin",
            actorRole: "admin",
            category: row.section === "backup" ? "backup" : "settings",
            action: `${row.section}.${row.field}`,
            resourceType: "AppSetting",
            resourceId: "singleton",
            source: "legacy",
            result: "success",
            changes: auditChanges(
              { [row.field]: row.oldValue },
              { [row.field]: row.newValue },
            ),
          },
        },
        { upsert: true },
      );
    }
  } finally {
    await cursor.close();
  }
  await AuditLog.updateOne(
    { _id: "system:legacy-imported" },
    {
      $setOnInsert: {
        at: new Date(),
        category: "settings",
        action: "audit.legacy-import-completed",
        resourceType: "AuditLog",
        source: "system",
      },
    },
    { upsert: true },
  );
}
