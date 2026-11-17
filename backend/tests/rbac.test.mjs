import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import User from "../src/models/userModel.js";
import Setting from "../src/models/appSettingModel.js";
import { JWT_SECRET } from "../src/config/env.js";
import { invalidateSettingsCache } from "../src/services/settingsService.js";
import { requirePermission } from "../src/middleware/authMiddleware.js";
import appointments from "../src/routes/adminAppointmentRoutes.js";
import records from "../src/routes/adminRecordRoutes.js";
import users from "../src/routes/adminUserRoutes.js";
import services from "../src/routes/adminServiceRoutes.js";
import monitoring from "../src/routes/adminMonitoringRoutes.js";
import therapist from "../src/routes/therapistRoutes.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import Verification from "../src/models/settingsVerificationModel.js";

const id = "111111111111111111111111";

test("Staff write routes reject read-only roles before touching persistence", async () => {
  const oldUser = User.findById, oldSetting = Setting.findOne;
  const oldExists = Verification.exists, oldSpend = Verification.findOneAndUpdate;
  let role = "secretary";
  let spends = 0;
  let consumed = false;
  User.findById = () => ({ select: async () => ({ role, isActive: true }) });
  const settings = new Setting({ auth: { permissions: {
    secretary: Object.fromEntries(["appointments", "patients", "userManagement", "services", "payments"].map((area) => [area, { read: true, create: false, update: false, delete: false }])),
    therapist: { appointments: { read: true, create: false, update: false, delete: false } },
  } } });
  Setting.findOne = async () => settings;
  Verification.exists = async () => consumed;
  Verification.findOneAndUpdate = async () => { spends += 1; if (consumed) return null; consumed = true; return {}; };
  invalidateSettingsCache();
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/admin/appointments", appointments);
  app.use("/admin/users", users);
  app.use("/admin/services", services);
  app.use("/admin", records, monitoring);
  app.use("/therapist", therapist);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = jwt.sign({ userId: id }, JWT_SECRET);
  const request = (path, method = "PATCH", body = {}, signedIn = true) => fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(signedIn ? { Cookie: `session=${session}` } : {}) }, body: JSON.stringify(body),
  });
  try {
    for (const [method, path] of [
      ["PATCH", `/admin/appointments/${id}/confirm`], ["PATCH", `/admin/appointments/${id}/cancel`],
      ["POST", `/admin/appointments/${id}/notification`], ["POST", `/admin/appointments/${id}/payment`],
      ["PATCH", `/admin/appointments/${id}/payment`], ["PATCH", `/admin/appointments/${id}/complete`],
      ["PATCH", `/admin/appointments/${id}/no-show`], ["PATCH", `/admin/patients/${id}`],
      ["PATCH", `/admin/therapists/${id}/working-days`], ["PATCH", `/admin/users/patients/${id}`],
      ["PATCH", `/admin/users/therapists/${id}/working-hours`], ["POST", "/admin/users"],
      ["PATCH", `/admin/users/${id}/activate`], ["DELETE", `/admin/users/${id}`],
      ["POST", "/admin/services"], ["PATCH", `/admin/services/${id}`], ["DELETE", `/admin/services/${id}`],
    ]) assert.equal((await request(path, method)).status, 403, `${method} ${path}`);
    role = "therapist";
    for (const [method, suffix] of [["POST", "reschedule-request"], ["PATCH", "no-show"], ["POST", "calendar-sync"]]) {
      assert.equal((await request(`/therapist/appointments/${id}/${suffix}`, method)).status, 403);
    }
    // Explicit grant works; denied read still prevents writes; unknown areas fail closed.
    settings.auth.permissions.secretary.services.update = true;
    settings.auth.permissions.secretary.patients.read = false;
    settings.auth.permissions.secretary.patients.update = true;
    invalidateSettingsCache();
    for (const [actor, area, action, allowed] of [
      ["unknown", "services", "update", false], ["therapist", "unknown", "read", false],
      ["secretary", "services", "read", true], ["admin", "services", "delete", true],
      ["secretary", "services", "update", true], ["secretary", "patients", "update", false],
    ]) {
      let next = false;
      const res = { status: () => res, json: () => {} };
      await requirePermission(area, action)({ user: { role: actor } }, res, () => { next = true; });
      assert.equal(next, allowed);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    User.findById = oldUser; Setting.findOne = oldSetting;
    Verification.exists = oldExists; Verification.findOneAndUpdate = oldSpend;
    invalidateSettingsCache();
  }
});
