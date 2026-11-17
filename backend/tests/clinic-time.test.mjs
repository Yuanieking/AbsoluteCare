import assert from "node:assert/strict";
import { test } from "node:test";
import { clinicDate, clinicDay } from "../src/utils/appointmentDates.js";

test("Clinic inputs and filter ends are always Manila regardless of server timezone", () => {
  assert.equal(clinicDate("2026-03-02T09:30").toISOString(), "2026-03-02T01:30:00.000Z");
  assert.equal(clinicDate("2026-03-02").toISOString(), "2026-03-01T16:00:00.000Z");
  assert.equal(clinicDate("2026-03-02", true).toISOString(), "2026-03-02T15:59:59.999Z");
  assert.equal(clinicDate("2026-03-02T09:30:00Z").toISOString(), "2026-03-02T09:30:00.000Z");
  assert.equal(clinicDay(new Date("2026-12-31T16:01:00Z")), "2027-01-01");
  assert.throws(() => clinicDate("not a date"));
});
