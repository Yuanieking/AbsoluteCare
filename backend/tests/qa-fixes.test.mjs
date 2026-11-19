import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import User from "../src/models/userModel.js";
import Appointment from "../src/models/appointmentModel.js";
import Setting from "../src/models/appSettingModel.js";
import { JWT_SECRET } from "../src/config/env.js";
import { invalidateSettingsCache } from "../src/services/settingsService.js";
import appointments from "../src/routes/adminAppointmentRoutes.js";
import monitoring from "../src/routes/adminMonitoringRoutes.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { createRateLimiter } from "../src/middleware/rateLimit.js";
import {
  coversService,
  needsSpecialist,
  therapistMismatch,
} from "../src/services/availabilityService.js";

const therapistId = "111111111111111111111111";
const ownId = "222222222222222222222222";
const otherId = "333333333333333333333333";

test("H6: therapists cannot act on appointments that are not theirs, nor confirm or assign", async () => {
  const oldFind = User.findById;
  const oldSetting = Setting.findOne;
  const oldExists = Appointment.exists;
  User.findById = () => ({
    select: async () => ({ role: "therapist", isActive: true }),
  });
  const full = { read: true, create: true, update: true, delete: false };
  const settings = new Setting({
    auth: { permissions: { therapist: { appointments: full } } },
  });
  Setting.findOne = async () => settings;
  Appointment.exists = async (filter) =>
    String(filter._id) === ownId && String(filter.therapist) === therapistId
      ? { _id: ownId }
      : null;
  invalidateSettingsCache();
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/admin/appointments", appointments);
  app.use("/admin", monitoring);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = jwt.sign({ userId: therapistId }, JWT_SECRET);
  const call = (method, path) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: `session=${session}` },
      body: method === "GET" ? undefined : "{}",
    }).then((response) => response.status);
  try {
    for (const [method, suffix] of [
      ["GET", ""],
      ["PATCH", "/confirm"],
      ["PATCH", "/assign-therapist"],
      ["PATCH", "/cancel"],
      ["PATCH", "/reschedule"],
      ["GET", "/available-therapists"],
    ])
      assert.equal(
        await call(method, `/admin/appointments/${otherId}${suffix}`),
        404,
        `${method} other${suffix}`,
      );
    for (const suffix of ["complete", "no-show"])
      assert.equal(await call("PATCH", `/admin/appointments/${otherId}/${suffix}`), 404);
    // Their own appointment: scheduling actions stay with admin and secretary.
    for (const suffix of ["/confirm", "/assign-therapist", "/available-therapists"])
      assert.equal(
        await call(suffix === "/available-therapists" ? "GET" : "PATCH", `/admin/appointments/${ownId}${suffix}`),
        403,
        `own${suffix}`,
      );
  } finally {
    server.close();
    User.findById = oldFind;
    Setting.findOne = oldSetting;
    Appointment.exists = oldExists;
    invalidateSettingsCache();
  }
});

test("H4: user payloads never carry password, reset token or calendar refresh token", () => {
  const user = new User({
    email: "qa-test@example.test",
    firstname: "QA",
    lastname: "Test",
    password: "hash",
    resetPasswordTokenHash: "a".repeat(64),
    resetPasswordExpiresAt: new Date(),
    googleCalendar: { connected: true, refreshTokenEncrypted: "secret" },
  });
  const value = user.omitPassword();
  assert.equal(value.password, undefined);
  assert.equal(value.resetPasswordTokenHash, undefined);
  assert.equal(value.resetPasswordExpiresAt, undefined);
  assert.equal(value.googleCalendar.refreshTokenEncrypted, undefined);
  assert.equal(value.googleCalendar.connected, true);
  assert.equal(user.password, "hash", "the document itself is not mutated");
});

test("H3: specializations match service categories, and uncovered services stay bookable", () => {
  const yuanie = { specialization: ["Sports Injury", "Post-op Rehab"] };
  const noel = { specialization: ["Physical Therapist (PTs)"] };
  const postOp = { name: "Post-operative Rehabilitation", category: "Post-op Rehab" };
  const pt = { name: "Physical Therapy & Rehabilitation", category: "Physical Therapy" };
  const consult = { name: "Consultation", category: "Consultation" };
  assert.equal(coversService(yuanie, postOp), true);
  assert.equal(coversService(noel, pt), true);
  assert.equal(coversService(yuanie, pt), false);
  assert.equal(needsSpecialist(consult, [yuanie, noel]), false);
  assert.equal(needsSpecialist(postOp, [yuanie, noel]), true);
  const start = new Date("2030-01-08T02:00:00Z");
  const end = new Date("2030-01-08T03:00:00Z");
  assert.match(therapistMismatch(yuanie, pt, start, end), /does not cover/);
  assert.equal(therapistMismatch(yuanie, consult, start, end, false), null);
});

function fakeExchange(limiter, status) {
  const res = new EventEmitter();
  res.statusCode = status;
  res.set = () => res;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = () => res;
  let passed = false;
  limiter({ ip: "203.0.113.9" }, res, () => {
    passed = true;
  });
  if (passed) res.emit("finish");
  return passed;
}

test("H1: the login limiter only spends failed attempts", () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    limit: 2,
    failuresOnly: true,
    body: { message: "Too many." },
  });
  for (let index = 0; index < 10; index += 1)
    assert.equal(fakeExchange(limiter, 200), true, "successful logins never lock out");
  assert.equal(fakeExchange(limiter, 401), true);
  assert.equal(fakeExchange(limiter, 401), true);
  assert.equal(fakeExchange(limiter, 401), false, "third failure is limited");
});

test("L13: one visit amount rule — collected when paid, booked fee when unpaid", async () => {
  const { visitAmount } = await import("../src/utils/payments.js");
  assert.equal(
    visitAmount({ payment: { status: "unpaid", amount: 0 }, serviceSnapshot: { fee: 1300 } }),
    1300,
  );
  assert.equal(
    visitAmount({ payment: { status: "paid", amount: 1000 }, serviceSnapshot: { fee: 1300 } }),
    1000,
  );
  assert.equal(visitAmount({ payment: { status: "unpaid", amount: 0 }, service: { fee: 900 } }), 900);
});

test("L12: calendar callback returns each role to its own page with a reason", async () => {
  const { calendarCallback } = await import("../src/controllers/calendarController.js");
  const oldSetting = Setting.findOne;
  Setting.findOne = async () => new Setting({});
  invalidateSettingsCache();
  const run = async (query) => {
    let location = "";
    await calendarCallback({ query }, { redirect: (url) => { location = url; } });
    return new URL(location);
  };
  try {
    const therapistState = jwt.sign({ purpose: "calendar", userId: therapistId, role: "therapist" }, JWT_SECRET);
    const denied = await run({ state: therapistState, error: "access_denied" });
    assert.equal(denied.pathname, "/staff/therapist/availability");
    assert.equal(denied.searchParams.get("calendar"), "error");
    assert.equal(denied.searchParams.get("reason"), "denied");

    const forged = jwt.sign({ purpose: "calendar", role: "therapist" }, "not-the-secret");
    const expired = await run({ state: forged });
    assert.equal(expired.pathname, "/staff/therapist/availability");
    assert.equal(expired.searchParams.get("reason"), "expired");

    const patientState = jwt.sign({ purpose: "calendar", userId: ownId, role: "patient" }, JWT_SECRET);
    assert.equal((await run({ state: patientState, error: "access_denied" })).pathname, "/settings");
    assert.equal((await run({})).pathname, "/settings");
  } finally {
    Setting.findOne = oldSetting;
    invalidateSettingsCache();
  }
});

test("L7: staff cannot assign or confirm a request whose requested time has passed", async () => {
  const service = await import("../src/services/adminAppointmentService.js");
  const { assignTherapist, confirmAppointment, listAvailableTherapists } = await import(
    "../src/controllers/adminAppointmentController.js"
  );
  const oldFindById = Appointment.findById;
  const past = {
    _id: ownId,
    status: "pending",
    requestedDate: "2026-01-05",
    requestedTime: "10:00",
    therapist: { _id: therapistId },
    serviceSnapshot: { name: "Sports Injury Recovery", duration: 60 },
    service: { name: "Sports Injury Recovery", duration: 60 },
    updatedAt: new Date(),
  };
  Appointment.findById = () => ({ populate: async () => past });
  try {
    for (const handler of [assignTherapist, confirmAppointment, listAvailableTherapists]) {
      let status = 0;
      let body = null;
      await handler(
        { params: { id: ownId }, body: { therapistId }, get: () => undefined, user: { userId: therapistId } },
        { status(code) { status = code; return this; }, json(value) { body = value; return this; } },
      );
      assert.equal(status, 409, handler.name);
      assert.equal(body.code, "REQUEST_PAST_DUE", handler.name);
    }
  } finally {
    Appointment.findById = oldFindById;
  }
  assert.ok(service.isAssignedTherapist);
});

test("reCAPTCHA: Google's invalid-input-secret returns RECAPTCHA_INVALID_KEY; a wrong answer stays RECAPTCHA_FAILED", async (t) => {
  const { default: verifyRecaptcha, INVALID_KEY_MESSAGE } = await import(
    "../src/middleware/verifyRecaptcha.js"
  );
  const { getIntegrationStatus } = await import("../src/config/integrations.js");
  if (!getIntegrationStatus().recaptcha.configured) {
    t.skip("reCAPTCHA keys are not configured in this environment");
    return;
  }
  const oldSetting = Setting.findOne;
  const oldFetch = globalThis.fetch;
  Setting.findOne = async () => new Setting({ integrations: { recaptchaEnabled: true } });
  invalidateSettingsCache();
  const run = async (googleReply) => {
    globalThis.fetch = async () => ({ ok: true, json: async () => googleReply });
    let status = 0;
    let body = null;
    let passed = false;
    await verifyRecaptcha(
      { body: { recaptchaToken: "token" }, ip: "127.0.0.1" },
      { status(code) { status = code; return this; }, json(value) { body = value; return this; } },
      () => { passed = true; },
    );
    return { status, body, passed };
  };
  try {
    const rejected = await run({ success: false, "error-codes": ["invalid-input-secret"] });
    assert.equal(rejected.status, 503);
    assert.equal(rejected.body.code, "RECAPTCHA_INVALID_KEY");
    assert.equal(rejected.body.message, INVALID_KEY_MESSAGE);
    assert.match(rejected.body.message, /^Invalid Key\. Google rejected this client ID and secret pair/);

    const wrongAnswer = await run({ success: false, "error-codes": ["invalid-input-response"] });
    assert.equal(wrongAnswer.status, 400);
    assert.equal(wrongAnswer.body.code, "RECAPTCHA_FAILED");

    const missing = await run({ success: false, "error-codes": ["missing-input-secret"] });
    assert.equal(missing.body.code, "RECAPTCHA_MISCONFIGURED");

    const ok = await run({ success: true });
    assert.equal(ok.passed, true);
  } finally {
    Setting.findOne = oldSetting;
    globalThis.fetch = oldFetch;
    invalidateSettingsCache();
  }
});
