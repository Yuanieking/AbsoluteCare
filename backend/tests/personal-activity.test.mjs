import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import Setting from "../src/models/appSettingModel.js";
import User from "../src/models/userModel.js";
import AuditLog from "../src/models/auditLogModel.js";
import { JWT_SECRET } from "../src/config/env.js";
import { invalidateSettingsCache, roleAccess, roleHasAccess } from "../src/services/settingsService.js";
import { validateSettingsSection } from "../src/schemas/settingsSchema.js";
import routes from "../src/routes/auditRoutes.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

const id = "111111111111111111111111";
const other = "222222222222222222222222";

test("Personal activity permission defaults, persists, validates, and never grants patient staff access", () => {
  const settings = new Setting();
  for (const role of ["therapist", "secretary", "user"]) {
    assert.equal(roleAccess({})[role].myActivity.read, true);
    settings.auth.permissions[role].myActivity.read = false;
    const restored = new Setting(settings.toObject());
    assert.equal(roleHasAccess(restored, role, "myActivity"), false);
  }
  assert.equal(roleHasAccess(settings, "user", "patients"), false);
  assert.equal(roleHasAccess(settings, "admin", "myActivity"), true);
  const auth = settings.toObject().auth;
  assert.equal(validateSettingsSection("auth", auth).permissions.user.myActivity.read, false);
  auth.permissions.user.myActivity.create = true;
  assert.throws(() => validateSettingsSection("auth", auth));
});

test("All personal audit endpoints enforce actor-only scope and permission revocation", async () => {
  const originals = { user: User.findById, settings: Setting.findOne, find: AuditLog.find, count: AuditLog.countDocuments, one: AuditLog.findOne };
  let role = "therapist";
  let reads = 0;
  const settings = new Setting();
  const own = { _id: "own", actorId: id, at: new Date(), action: "User.update", category: "account", resourceType: "User", resourceId: id, result: "success", changes: [{ field: "private", after: "hidden" }] };
  const rows = [own, { ...own, _id: "subject-only", actorId: other, subjects: [id] }];
  const matches = (filter) => {
    assert.equal(filter.actorId, id);
    assert.equal(filter.$or, undefined);
    return rows.filter((row) => row.actorId === filter.actorId && (!filter._id || row._id === filter._id));
  };
  User.findById = () => ({ select: async () => ({ role, isActive: true }) });
  Setting.findOne = async () => settings;
  AuditLog.find = (filter) => {
    reads++;
    const query = { sort: () => query, skip: () => query, limit: () => query, lean: async () => matches(filter) };
    return query;
  };
  AuditLog.countDocuments = async (filter) => matches(filter).length;
  AuditLog.findOne = (filter) => ({ lean: async () => { reads++; return matches(filter)[0] || null; } });
  invalidateSettingsCache();
  const app = express();
  app.use(cookieParser());
  app.use("/audit", routes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/audit`;
  const headers = { Cookie: `session=${jwt.sign({ userId: id }, JWT_SECRET)}` };
  try {
    for (role of ["therapist", "secretary", "user"]) {
      const list = await fetch(`${base}?actor=${other}&role=admin&search=User&category=account&result=success&from=2026-01-01&to=2026-12-31`, { headers });
      assert.equal(list.status, 200);
      const body = await list.json();
      assert.deepEqual(body.entries.map((entry) => entry._id), ["own"]);
      assert.equal(body.pagination.total, 1);
      assert.equal(body.entries[0].changes, undefined);
      const detail = await fetch(`${base}/own`, { headers });
      assert.equal(detail.status, 200);
      assert.equal((await detail.json()).entry.action, own.action);
      assert.equal((await fetch(`${base}/subject-only`, { headers })).status, 404);
      assert.equal((await fetch(`${base}/export`, { headers })).status, 403);
      settings.auth.permissions[role].myActivity.read = false;
      invalidateSettingsCache();
      const before = reads;
      for (const suffix of ["", "/own", "/export"]) {
        assert.equal((await fetch(base + suffix, { headers })).status, 403);
      }
      assert.equal(reads, before);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    User.findById = originals.user;
    Setting.findOne = originals.settings;
    AuditLog.find = originals.find;
    AuditLog.countDocuments = originals.count;
    AuditLog.findOne = originals.one;
    invalidateSettingsCache();
  }
});
