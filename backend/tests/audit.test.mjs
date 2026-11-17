import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {
  auditChanges,
  auditContext,
  auditPlugin,
} from "../src/services/auditCapture.js";
import {
  auditFilter,
  csvCell,
  visibleAudit,
  importLegacyAudit,
} from "../src/services/auditService.js";
import { auditQuerySchema } from "../src/schemas/auditSchema.js";
import AuditLog from "../src/models/auditLogModel.js";
import User from "../src/models/userModel.js";
import Setting from "../src/models/appSettingModel.js";
import { invalidateSettingsCache } from "../src/services/settingsService.js";
import auditRoutes from "../src/routes/auditRoutes.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { JWT_SECRET } from "../src/config/env.js";
const id = "111111111111111111111111",
  other = "222222222222222222222222";

test("Redaction is allowlist-based and never retains credentials, notes, names or arbitrary values", () => {
  const changes = auditChanges(
    { status: "pending", clinicalNotes: "old clinical" },
    {
      status: "confirmed",
      clinicalNotes: "private clinical",
      password: "bcrypt",
      refreshTokenEncrypted: "token",
      phone: "0912",
      firstName: "Patient",
      arbitrary: "secret",
      auth: { permissions: { therapist: { sessions: { read: false } } } },
    },
  );
  const text = JSON.stringify(changes);
  for (const value of [
    "old clinical",
    "private clinical",
    "bcrypt",
    'token"',
    "0912",
    "Patient",
    '"secret"',
  ])
    assert.ok(!text.includes(value));
  assert.equal(
    changes.find((item) => item.field === "status").after,
    "confirmed",
  );
  assert.equal(
    changes.find(
      (item) => item.field === "auth.permissions.therapist.sessions.read",
    ).after,
    false,
  );
});

test("Own scope cannot be widened by search; metadata excludes all changes and actor identity", () => {
  const filter = auditFilter(
    { search: ".*", actor: "Other", role: "admin" },
    { id, role: "user" },
  );
  assert.equal(filter.actorId, id);
  assert.equal(filter.$or, undefined);
  assert.equal(filter.actorRole, undefined);
  assert.equal(filter.$and[0].$or[0].action.$regex, "\\.\\*");
  const safe = visibleAudit(
    {
      _id: "a",
      actorName: "Private",
      changes: [{ field: "payment.amount", after: 50 }],
      subjects: [other],
      requestId: "private",
      action: "updated",
    },
    "therapist",
  );
  assert.equal(safe.actorName, undefined);
  assert.equal(safe.changes, undefined);
  assert.equal(safe.subjects, undefined);
  const range = auditFilter(
    { from: "2026-03-02", to: "2026-03-02" },
    { id, role: "admin" },
  );
  assert.equal(range.at.$gte.toISOString(), "2026-03-01T16:00:00.000Z");
  assert.equal(range.at.$lte.toISOString(), "2026-03-02T15:59:59.999Z");
  assert.equal(
    auditQuerySchema.safeParse({ from: "2026-02-30" }).success,
    false,
  );
  assert.equal(auditQuerySchema.safeParse({ userId: other }).success, false);
  assert.equal(auditQuerySchema.safeParse({ limit: 100000 }).success, false);
  assert.ok(csvCell('=HYPERLINK("evil")').startsWith("\"'"));
});

test("Real Mongoose save/query hooks record create and update under the correct async actor", async () => {
  const isolated = new mongoose.Mongoose();
  const schema = new isolated.Schema(
    { status: String, patient: mongoose.Schema.Types.ObjectId },
    { bufferCommands: false },
  );
  schema.plugin(auditPlugin);
  const Service = isolated.model("TherapyService", schema);
  const originalCreate = AuditLog.create;
  const captured = [];
  const data = new Map();
  AuditLog.create = async (events) => {
    captured.push(...events);
    return events;
  };
  const clone = (value) =>
    mongoose.mongo.BSON.EJSON.parse(
      mongoose.mongo.BSON.EJSON.stringify(value),
      { relaxed: true },
    );
  Service.collection.insertOne = async (doc) => {
    data.set(String(doc._id), clone(doc));
    return { acknowledged: true };
  };
  Service.collection.updateOne = async (filter, update) => {
    Object.assign(data.get(String(filter._id)), update.$set);
    return { matchedCount: 1, modifiedCount: 1 };
  };
  Service.collection.findOne = async (filter) =>
    clone(data.get(String(filter._id)) || null);
  Service.collection.find = () => ({
    toArray: async () => [...data.values()].map(clone),
  });
  try {
    await auditContext.run(
      {
        actor: { actorId: id, actorRole: "admin", actorName: "Admin Example" },
        requestId: "request",
      },
      async () => {
        const record = new Service({ status: "active" });
        await record.save();
        record.status = "retired";
        await record.save();
        await Service.updateOne(
          { _id: record._id },
          { $set: { status: "active" } },
        );
      },
    );
    assert.equal(captured.length, 3);
    assert.equal(captured[0].actorId, id);
    assert.equal(captured[0].action, "TherapyService.create");
    assert.equal(captured[1].changes[0].after, "retired");
    assert.equal(captured[2].changes[0].after, "active");
    Service.collection.updateOne = async () => {
      throw new Error("secret-bearing driver error");
    };
    await assert.rejects(
      Service.updateOne(
        { _id: [...data.keys()][0] },
        { $set: { status: "retired" } },
      ),
    );
    assert.equal(captured.at(-1).result, "failure");
    assert.ok(!JSON.stringify(captured.at(-1)).includes("secret-bearing"));
  } finally {
    AuditLog.create = originalCreate;
  }
});

test("Historical import is idempotent and never reimports post-cutoff embedded changes", async () => {
  const oldDb = mongoose.connection.db,
    oldState = mongoose.connection.readyState;
  const oldExists = AuditLog.exists,
    oldById = AuditLog.findById,
    oldUpdate = AuditLog.updateOne,
    oldBulk = AuditLog.bulkWrite;
  const events = new Map();
  const cutoff = new Date("2026-03-02T00:00:00Z");
  const docId = new mongoose.Types.ObjectId(id);
  AuditLog.exists = async ({ _id }) => events.has(_id);
  AuditLog.findById = () => ({ lean: async () => ({ at: cutoff }) });
  AuditLog.updateOne = async (filter, update) => {
    if (!events.has(filter._id)) events.set(filter._id, update.$setOnInsert);
  };
  AuditLog.bulkWrite = async (operations) => {
    for (const { updateOne } of operations)
      await AuditLog.updateOne(updateOne.filter, updateOne.update);
  };
  mongoose.connection.readyState = 1;
  mongoose.connection.db = {
    collection: (name) => ({
      find: () => {
        const rows =
          name === "users"
            ? [
                {
                  _id: docId,
                  accountAudit: [
                    {
                      _id: "old",
                      by: docId,
                      at: new Date("2026-03-01T00:00:00Z"),
                      action: "updated",
                    },
                    {
                      _id: "new",
                      by: docId,
                      at: new Date("2026-03-03T00:00:00Z"),
                      action: "updated",
                    },
                  ],
                },
              ]
            : [];
        return {
          async *[Symbol.asyncIterator]() {
            yield* rows;
          },
          close: async () => {},
        };
      },
    }),
  };
  try {
    await importLegacyAudit();
    const count = events.size;
    assert.equal(count, 2);
    assert.ok(events.has(`legacy:users:accountAudit:${id}:old`));
    assert.ok(!events.has(`legacy:users:accountAudit:${id}:new`));
    await importLegacyAudit();
    assert.equal(events.size, count);
  } finally {
    mongoose.connection.db = oldDb;
    mongoose.connection.readyState = oldState;
    AuditLog.exists = oldExists;
    AuditLog.findById = oldById;
    AuditLog.updateOne = oldUpdate;
    AuditLog.bulkWrite = oldBulk;
  }
});

test("HTTP audit access is authenticated, own-scoped, admin-only export and read-only", async () => {
  const oldUser = User.findById,
    oldFind = AuditLog.find,
    oldCount = AuditLog.countDocuments,
    oldOne = AuditLog.findOne;
  const oldSetting = Setting.findOne;
  Setting.findOne = async () => new Setting();
  invalidateSettingsCache();
  let role = "user",
    captured;
  User.findById = () => ({ select: async () => ({ role, isActive: true }) });
  const entry = {
    _id: "event",
    at: new Date(),
    actorId: other,
    actorName: "Staff",
    actorRole: "admin",
    category: "account",
    action: "User.update",
    resourceType: "User",
    resourceId: id,
    result: "success",
    changes: [{ field: "password", after: "[redacted]" }],
    subjects: [id],
  };
  AuditLog.find = (filter) => {
    captured = filter;
    const query = {
      sort: () => query,
      skip: () => query,
      limit: () => query,
      lean: () => query,
      then: (resolve) => Promise.resolve([entry]).then(resolve),
      cursor: () => ({
        async *[Symbol.asyncIterator]() {
          yield entry;
        },
        close: async () => {},
      }),
    };
    return query;
  };
  AuditLog.countDocuments = async () => 1;
  AuditLog.findOne = (filter) => {
    captured = filter;
    return { lean: async () => null };
  };
  const app = express();
  app.use(cookieParser());
  app.use("/audit", auditRoutes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Cookie: `session=${jwt.sign({ userId: id }, JWT_SECRET)}` };
  try {
    assert.equal((await fetch(base + "/audit")).status, 401);
    const response = await fetch(base + "/audit", { headers });
    const body = await response.json();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.entries[0].changes, undefined);
    assert.equal(captured.actorId, id);
    assert.equal(captured.$or, undefined);
    assert.equal(
      (await fetch(base + "/audit/export", { headers })).status,
      403,
    );
    assert.equal((await fetch(base + "/audit/other", { headers })).status, 404);
    assert.equal(captured.actorId, id);
    assert.equal(captured.$or, undefined);
    assert.equal(
      (await fetch(base + "/audit?userId=" + other, { headers })).status,
      400,
    );
    role = "admin";
    const exported = await fetch(base + "/audit/export", { headers });
    assert.equal(exported.status, 200);
    assert.ok((await exported.text()).includes("Time (Asia/Manila"));
    assert.equal(captured.$or, undefined);
    assert.equal(
      (await fetch(base + "/audit/event", { method: "DELETE", headers }))
        .status,
      404,
    );
    role = "secretary";
    assert.equal((await fetch(base + "/audit", { headers })).status, 200);
    assert.equal(captured.actorId, id);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    Setting.findOne = oldSetting;
    invalidateSettingsCache();
    User.findById = oldUser;
    AuditLog.find = oldFind;
    AuditLog.countDocuments = oldCount;
    AuditLog.findOne = oldOne;
  }
});
