import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { once } from "node:events";
import express from "express";
import Appointment from "../src/models/appointmentModel.js";
import User from "../src/models/userModel.js";
import TherapyService from "../src/models/therapyServiceModel.js";
import Session from "../src/models/sessionModel.js";
import Setting from "../src/models/appSettingModel.js";
import Credential from "../src/models/integrationCredentialModel.js";
import { availabilitySchema } from "../src/schemas/availabilitySchema.js";
import { therapyServiceSchema } from "../src/schemas/therapyServiceSchema.js";
import { sessionInputSchema, sessionUpdateSchema } from "../src/schemas/sessionSchema.js";
import { availabilityError, bookingTimes, findConflicts, saveAvailability } from "../src/services/availabilityService.js";
import { encrypt, syncConfirmedAppointment, backfillCalendar } from "../src/services/calendarService.js";
import { invalidateSettingsCache } from "../src/services/settingsService.js";
import { listBookingTimes, requestAppointment } from "../src/controllers/patientController.js";
import { manilaDateTime } from "../src/utils/appointmentDates.js";

const date = "2099-03-02";
const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Manila" }).format(manilaDateTime(date, "09:00"));
const id = "111111111111111111111111";
const hours = [{ day, start: "08:00", end: "17:00" }];
const service = { _id: id, name: "Physical Therapy", duration: 60 };
const window = (start, end) => [manilaDateTime(date, start), manilaDateTime(date, end)];

test("30-minute minimum holds in service/session input, PATCH, and models", () => {
  for (const duration of [1, 29, 30.5]) {
    assert.equal(therapyServiceSchema.safeParse({ name: "Therapy", duration, fee: 0 }).success, false);
    assert.equal(sessionUpdateSchema.safeParse({ durationMinutes: duration }).success, false);
  }
  assert.equal(therapyServiceSchema.parse({ name: "Therapy", duration: 30, fee: 0 }).duration, 30);
  assert.equal(sessionInputSchema.parse({ sessionDate: date, durationMinutes: 30 }).durationMinutes, 30);
  assert.equal(sessionUpdateSchema.safeParse({ clinicalNotes: "Updated" }).success, true);
  assert.ok(new TherapyService({ name: "Therapy", duration: 1, fee: 0 }).validateSync().errors.duration);
  assert.ok(new Session({ durationMinutes: 1 }).validateSync().errors.durationMinutes);
});

test("Weekly hours, full duration, midnight and date overrides share one guard", () => {
  const user = { workingHoursByDay: hours };
  assert.equal(availabilityError(user, ...window("16:00", "17:00")), null);
  assert.ok(availabilityError(user, ...window("16:30", "17:30")));
  assert.ok(availabilityError({}, ...window("20:00", "21:00")));
  assert.ok(availabilityError(user, ...window("23:30", "00:30")));
  assert.ok(availabilityError(user, manilaDateTime(date, "23:30"), new Date(manilaDateTime(date, "23:30").getTime() + 3600000)));
  const overridden = { ...user, dateOverrides: [{ date, start: "10:00", end: "12:00" }] };
  assert.equal(availabilityError(overridden, ...window("10:00", "11:00")), null);
  assert.ok(availabilityError(overridden, ...window("09:00", "10:00")));
  assert.ok(availabilityError({ ...user, dateOverrides: [{ date, unavailable: true }] }, ...window("10:00", "11:00")));
  assert.equal(availabilitySchema.safeParse({ workingDays: [day], workingHoursByDay: hours, dateOverrides: [{ date, start: "12:00", end: "10:00" }] }).success, false);
  assert.equal(availabilitySchema.safeParse({ workingDays: [day], dateOverrides: [{ date }, { date }] }).success, false);
  assert.equal(availabilitySchema.safeParse({ workingDays: [day], dateOverrides: [{ date: "2099-02-30" }] }).success, false);
});

test("Booking endpoint lists valid times and rejects a direct out-of-hours POST", async () => {
  mock.method(User, "find", () => ({ select: async () => [{ _id: id, workingHoursByDay: hours }] }));
  mock.method(Appointment, "find", () => ({ select: async () => [] }));
  mock.method(TherapyService, "findOne", async () => service);
  const create = mock.method(Appointment, "create", async () => { throw new Error("Must not persist invalid booking"); });
  const app = express();
  app.use(express.json(), (req, res, next) => { req.patient = { _id: id }; next(); });
  app.get("/availability", listBookingTimes);
  app.post("/appointments", requestAppointment);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${url}/availability?service=${id}&date=${date}`);
    assert.equal(response.status, 200);
    const { times } = await response.json();
    assert.equal(times[0], "08:00");
    assert.equal(times.at(-1), "16:00");
    assert.ok(!times.includes("16:15"));
    const rejected = await fetch(`${url}/appointments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: id, requestedDate: date, requestedTime: "22:00" }) });
    assert.equal(rejected.status, 400);
    assert.deepEqual(await rejected.json(), { message: "Choose an available time within therapist working hours." });
    assert.equal(create.mock.callCount(), 0);
    assert.deepEqual(await bookingTimes(service, date, id, { time: "09:07" }), ["09:07"]);
    mock.method(Appointment, "find", () => ({ select: async () => [{ therapist: id, scheduledStart: manilaDateTime(date, "09:00"), scheduledEnd: manilaDateTime(date, "10:00") }] }));
    assert.deepEqual(await bookingTimes(service, date, id, { time: "09:07" }), []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
  }
});

test("Date overrides persist and protect unscheduled pending visits", async () => {
  const pending = { _id: id, requestedDate: date, requestedTime: "09:00", serviceSnapshot: { duration: 60 }, patient: {} };
  mock.method(Appointment, "find", () => ({ populate() { return this; }, sort() { return this; }, lean: async () => [pending] }));
  mock.method(User, "find", () => ({ select: async () => [] }));
  try {
    const conflicts = await findConflicts(id, hours, [{ date, unavailable: true }]);
    assert.equal(conflicts.length, 1);
    let saves = 0;
    const therapist = { workingHoursByDay: hours, accountAudit: [], save: async () => { saves++; } };
    const dateOverrides = [{ date, start: "10:00", end: "12:00", unavailable: false }];
    await saveAvailability({ therapist, days: hours, dateOverrides, actorId: id });
    assert.deepEqual(therapist.dateOverrides, dateOverrides);
    assert.equal(saves, 1);
    assert.match(therapist.accountAudit[0].details, /2099-03-02/);
  } finally { mock.restoreAll(); }
});

test("Google create/backfill and approved reschedules use the correct event and calendar owner", async () => {
  process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY = "test-only-calendar-key";
  mock.method(Credential, "find", () => ({ lean: async () => [] }));
  const settings = new Setting({ integrations: { googleCalendarEnabled: true } });
  mock.method(Setting, "findOne", async () => settings);
  invalidateSettingsCache();
  const appointment = { _id: id, patient: id, therapist: { _id: "222222222222222222222222" }, service, status: "confirmed", scheduledStart: manilaDateTime(date, "09:00"), scheduledEnd: manilaDateTime(date, "10:00"), save: async () => {} };
  mock.method(Appointment, "findById", () => ({ populate: async () => appointment }));
  mock.method(Appointment, "find", async () => [appointment]);
  mock.method(User, "findById", async () => ({ _id: id, googleCalendar: { connected: true, refreshTokenEncrypted: encrypt("test-refresh") } }));
  const update = mock.method(User, "updateOne", async () => {});
  const requests = [];
  let failure = 0;
  let tokenFailure = 0;
  mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).includes("oauth2.googleapis.com")) {
      if (tokenFailure) { const status = tokenFailure; tokenFailure = 0; return Response.json({}, { status }); }
      return Response.json({ access_token: "test-access" });
    }
    requests.push({ url, ...options });
    if (failure) { const status = failure; failure = 0; return Response.json({}, { status }); }
    return Response.json({ id: "event-123", htmlLink: "https://calendar.google.com/event-123" });
  });
  try {
    await backfillCalendar(id, "patient");
    assert.equal(appointment.googleEventId, "event-123");
    assert.equal(appointment.therapistGoogleEventId, undefined);
    assert.equal(requests[0].url, "https://www.googleapis.com/calendar/v3/calendars/primary/events");
    assert.equal(requests[0].method, "POST");
    appointment.rescheduleRequest = { status: "requested", proposedDate: date, proposedTime: "11:00" };
    await syncConfirmedAppointment(id);
    assert.equal(JSON.parse(requests.at(-1).body).start.dateTime, manilaDateTime(date, "09:00").toISOString());
    appointment.scheduledStart = manilaDateTime(date, "11:00");
    appointment.scheduledEnd = manilaDateTime(date, "12:00");
    await syncConfirmedAppointment(id);
    assert.equal(requests.at(-1).method, "PUT");
    assert.equal(requests.at(-1).url, "https://www.googleapis.com/calendar/v3/calendars/primary/events/event-123");
    assert.equal(JSON.parse(requests.at(-1).body).start.dateTime, appointment.scheduledStart.toISOString());
    failure = 503;
    await assert.rejects(syncConfirmedAppointment(id), /request failed/);
    assert.equal(update.mock.callCount(), 0);
    tokenFailure = 503;
    await assert.rejects(syncConfirmedAppointment(id), /token refresh failed/);
    assert.equal(update.mock.callCount(), 0);
    failure = 404;
    await syncConfirmedAppointment(id);
    assert.equal(requests.at(-1).method, "POST");
    await backfillCalendar(appointment.therapist._id, "therapist");
    assert.equal(appointment.therapistGoogleEventId, "event-123");
  } finally { mock.restoreAll(); invalidateSettingsCache(); }
});
