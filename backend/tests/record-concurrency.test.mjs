import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import express from "express";
import { once } from "node:events";
import { recordConcurrencyPlugin, recordWriteContext, recordTarget } from "../src/services/recordConcurrency.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { visibleEditors, EDITOR_TTL_MS, updateRecordEditors } from "../src/services/recordEditorsService.js";
import User from "../src/models/userModel.js";
import RecordEditors from "../src/models/recordEditorsModel.js";
import editorRoutes from "../src/routes/recordEditorsRoutes.js";
import AppSetting from "../src/models/appSettingModel.js";
import { withSettingsEdit } from "../src/services/settingsService.js";

const id = "111111111111111111111111";

test("Presence endpoints require authentication and keep editor array separate from record timestamps", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/record-editors", editorRoutes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/record-editors/users/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: crypto.randomUUID() }),
    });
    assert.equal(response.status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); }
  const actor = { userId: id, role: "admin" };
  t.mock.method(User, "findOne", () => ({ lean: async () => ({ _id: id }) }));
  t.mock.method(User, "findById", () => ({ select: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(id), firstname: "Alice", lastname: "Example" }) }) }));
  let captured;
  t.mock.method(RecordEditors, "findOneAndUpdate", (filter, update, options) => {
    captured = { filter, update, options };
    return { lean: async () => ({ activeEditors: [{ userId: id, name: "Alice Example", lastSeenAt: new Date() }] }) };
  });
  const sessionId = crypto.randomUUID();
  const editors = await updateRecordEditors(actor, "users", id, sessionId);
  assert.equal(editors[0].name, "Alice Example");
  assert.equal(captured.options.updatePipeline, true);
  assert.ok(captured.update[0].$set.activeEditors.$concatArrays);
  await updateRecordEditors(actor, "users", id, sessionId, true);
  assert.deepEqual(captured.update.$pull.activeEditors, { userId: id, sessionId });
  await assert.rejects(updateRecordEditors({ userId: "222222222222222222222222", role: "user" }, "users", id, sessionId), (error) => error.status === 403);
});
test("Credential batch reserves a shared settings timestamp before side effects and always releases its lease", async (t) => {
  let reserved = false;
  let released = false;
  t.mock.method(AppSetting, "findOneAndUpdate", (filter, update) => ({ exec: async () => {
    assert.ok(filter.updatedAt instanceof Date);
    if (reserved) return null;
    reserved = true;
    assert.ok(update.$set.editLease);
    return { updatedAt: update.$set.updatedAt };
  } }));
  t.mock.method(AppSetting, "updateOne", () => ({ exec: async () => { released = true; return { matchedCount: 1 }; } }));
  const timestamp = "2026-01-01T00:00:00.000Z";
  let writes = 0;
  await withSettingsEdit(timestamp, async () => {
    writes++;
    await assert.rejects(withSettingsEdit(timestamp, async () => { writes++; }), (error) => error.status === 409);
  });
  assert.equal(writes, 1);
  assert.equal(released, true);
});

test("Edit route targets include all record families and exclude operational POSTs", () => {
  for (const path of [`/admin/users/${id}`, `/admin/patients/${id}`, `/dependents/${id}`, `/therapist/sessions/${id}`, `/admin/services/${id}`, "/therapist/availability", "/auth/profile", "/admin/settings/system"])
    assert.ok(recordTarget(path, "PATCH"), path);
  assert.ok(recordTarget(`/appointments/${id}/cancel`, "POST"));
  assert.ok(recordTarget(`/secretary/appointments/${id}/payment`, "POST"));
  assert.equal(recordTarget(`/appointments/${id}/calendar-sync`, "POST"), null);
  assert.equal(recordTarget("/auth/login", "POST"), null);
});

test("Editor display expires abandoned sessions and deduplicates users, not sessions", () => {
  const now = new Date();
  const entries = [
    { userId: id, name: "Alice", lastSeenAt: now },
    { userId: id, name: "Alice", lastSeenAt: now },
    { userId: "222222222222222222222222", name: "Bob", lastSeenAt: now },
    { userId: "333333333333333333333333", name: "Gone", lastSeenAt: new Date(now - EDITOR_TTL_MS) },
  ];
  assert.deepEqual(visibleEditors(entries, now).map((item) => item.name), ["Alice", "Bob"]);
});

test("Real save/query hooks atomically reject simultaneous and missing-precondition writes through HTTP", async () => {
  const isolated = new mongoose.Mongoose();
  const schema = new isolated.Schema({ name: String }, { timestamps: true, bufferCommands: false });
  schema.plugin(recordConcurrencyPlugin);
  const Model = isolated.model("TherapyService", schema);
  let stored = { _id: new isolated.Types.ObjectId(id), name: "Original", updatedAt: new Date("2026-01-01T00:00:00Z") };
  const clone = () => ({ ...stored });
  const match = (filter) => String(filter._id) === id && new Date(filter.updatedAt).getTime() === stored.updatedAt.getTime();
  Model.collection.findOne = async () => clone();
  Model.collection.updateOne = async (filter, update) => {
    if (!match(filter)) return { matchedCount: 0, modifiedCount: 0 };
    Object.assign(stored, update.$set);
    return { matchedCount: 1, modifiedCount: 1 };
  };
  Model.collection.findOneAndUpdate = async (filter, update) => {
    if (!match(filter)) return null;
    Object.assign(stored, update.$set);
    return clone();
  };
  const timestamp = stored.updatedAt.toISOString();
  const first = Model.hydrate(clone());
  const second = Model.hydrate(clone());
  first.name = "Alice"; second.name = "Bob";
  const write = (action, ifMatch = timestamp) => recordWriteContext.run({ target: `TherapyService:${id}`, ifMatch }, action);
  const results = await Promise.allSettled([write(() => first.save()), write(() => second.save())]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(stored.name, "Alice");
  assert.ok(stored.updatedAt > new Date(timestamp));
  await assert.rejects(write(() => Model.findOneAndUpdate({ _id: id }, { name: "Overwrite" }, { new: true }).exec()), (error) => error.status === 409);
  await assert.rejects(write(() => Model.updateOne({ _id: id }, { name: "Unchecked" }).exec(), "*"), (error) => error.status === 428);
  const app = express();
  app.use(express.json());
  app.patch("/services/:id", (req, res, next) => {
    write(async () => {
      const result = await Model.findOneAndUpdate({ _id: id }, { name: req.body.name }, { new: true });
      res.json({ service: result });
    }, req.get("If-Match")).catch(next);
  });
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/services/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", "If-Match": timestamp }, body: JSON.stringify({ name: "Stale" }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "STALE_RECORD");
    assert.equal(stored.name, "Alice");
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
