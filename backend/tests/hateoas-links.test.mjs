import test from "node:test";
import assert from "node:assert/strict";
import { logout } from "../src/controllers/authController.js";
import { calendarCallback } from "../src/controllers/calendarController.js";
import { driveCallback } from "../src/controllers/googleDriveController.js";
import { recordTarget } from "../src/services/recordConcurrency.js";

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    location: null,
    cleared: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    redirect(url) {
      this.location = url;
      return this;
    },
    clearCookie(name) {
      this.cleared.push(name);
    },
  };
}

test("logout returns 200 JSON with HATEOAS _links", () => {
  const res = mockResponse();
  logout({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.cleared, ["session"]);
  assert.equal(res.body._links.login.href, "/api/v1/auth/login");
  assert.equal(res.body._links.google.href, "/api/v1/auth/google");
});

test("OAuth callbacks return JSON with redirectUrl and _links when Accept: application/json", async () => {
  const calRes = mockResponse();
  await calendarCallback(
    { query: { state: "invalid" }, headers: { accept: "application/json" } },
    calRes,
  );
  assert.equal(calRes.statusCode, 400);
  assert.equal(calRes.location, null);
  assert.equal(calRes.body.status, "error");
  assert.match(calRes.body.redirectUrl, /calendar=error/);
  assert.equal(calRes.body._links.redirect.href, calRes.body.redirectUrl);

  const driveRes = mockResponse();
  await driveCallback(
    { query: { state: "invalid" }, headers: { accept: "application/json" } },
    driveRes,
  );
  assert.equal(driveRes.statusCode, 400);
  assert.equal(driveRes.location, null);
  assert.equal(driveRes.body.status, "error");
  assert.match(driveRes.body.redirectUrl, /drive=error/);
  assert.equal(driveRes.body._links.redirect.href, driveRes.body.redirectUrl);
});

test("recordTarget strips /api/v1 prefix when matching record paths", () => {
  const id = "507f1f77bcf86cd799439011";
  assert.equal(recordTarget(`/api/v1/admin/users/${id}`, "PATCH"), `User:${id}`);
  assert.equal(recordTarget("/api/v1/auth/profile", "PATCH"), "User:self");
});
