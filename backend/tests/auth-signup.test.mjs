import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { test } from "node:test";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Boot the native-ESM app and exercise the real HTTP routes. Only
// persistence and outbound HTTP are replaced; no clinic data is written.
test("Signup creates a patient session while preserving registration and access restrictions", async () => {
  process.env.PORT = "0";
  process.env.NODE_ENV = "production";
  process.env.ADMIN_EMAILS = "";
  process.env.BREVO_API_KEY = "";
  const { default: Setting } = await import("../src/models/appSettingModel.js");
  const { default: Credential } =
    await import("../src/models/integrationCredentialModel.js");
  const { default: User } = await import("../src/models/userModel.js");
  const { default: Dependent } =
    await import("../src/models/dependentModel.js");
  const { invalidateSettingsCache } =
    await import("../src/services/settingsService.js");
  const { JWT_SECRET } = await import("../src/config/env.js");
  const { default: jwt } = await import("jsonwebtoken");
  const settings = new Setting({
    auth: { patientRegistrationEnabled: true, passwordMinLength: 8 },
    notifications: { remindersEnabled: false },
    integrations: {
      recaptchaEnabled: false,
      googleDriveEnabled: false,
      emailEnabled: false,
    },
  });
  const users = new Map();
  mongoose.connect = async () => mongoose;
  Setting.findOne = async () => settings;
  Credential.find = () => {
    const query = { select: () => query, lean: async () => [] };
    return query;
  };
  User.findOne = async ({ email }) =>
    [...users.values()].find((user) => user.email === email) || null;
  User.create = async (input) => {
    const user = new User(input);
    await user.validate();
    users.set(user._id.toString(), user);
    return user;
  };
  User.findById = (id) => {
    const user = users.get(String(id)) || null;
    return {
      select: async () => user,
      then: (resolve) => Promise.resolve(user).then(resolve),
    };
  };
  Dependent.exists = async () => null;
  globalThis.fetch = async () => {
    throw new Error("Unexpected outbound HTTP");
  };

  const intervals = [];
  const originalInterval = globalThis.setInterval;
  globalThis.setInterval = (...args) => {
    const timer = originalInterval(...args);
    intervals.push(timer);
    return timer;
  };
  const originalListen = http.Server.prototype.listen;
  let server;
  http.Server.prototype.listen = function (...args) {
    server = this;
    return originalListen.apply(this, args);
  };
  try {
    await import("../src/app.js");
    if (!server.listening) await once(server, "listening");
    const port = server.address().port;
    async function request(path, { body, cookie } = {}) {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path,
            method: body ? "POST" : "GET",
            headers: {
              "Content-Type": "application/json",
              ...(cookie ? { Cookie: cookie } : {}),
            },
          },
          (res) => {
            let text = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              text += chunk;
            });
            res.on("end", () =>
              resolve({
                status: res.statusCode,
                body: JSON.parse(text),
                headers: res.headers,
              }),
            );
          },
        );
        req.on("error", reject);
        req.end(body ? JSON.stringify(body) : undefined);
      });
    }
    const payload = {
      firstName: "New",
      lastName: "Patient",
      email: "new.patient@example.com",
      phone: "09171234567",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
      acceptedTerms: true,
      role: "admin",
      isActive: false,
    };
    assert.equal((await request("/auth/me")).status, 401);
    const created = await request("/auth/signup", { body: payload });
    assert.equal(created.status, 201);
    assert.deepEqual(Object.keys(created.body).sort(), ["message", "user"]);
    assert.equal(created.body.message, "Account created successfully.");
    assert.equal(created.body.user.role, "user");
    assert.equal(created.body.user.isActive, true);
    assert.equal(created.body.user.password, undefined);
    assert.equal(created.body.user.confirmPassword, undefined);
    const stored = users.get(created.body.user._id);
    assert.ok(stored);
    assert.notEqual(stored.password, payload.password);
    assert.equal(await bcrypt.compare(payload.password, stored.password), true);
    const cookies = created.headers["set-cookie"] || [];
    assert.equal(cookies.length, 1);
    assert.match(cookies[0], /^session=/);
    assert.match(cookies[0], /HttpOnly/);
    assert.match(cookies[0], /Secure/);
    assert.match(cookies[0], /SameSite=None/);
    const cookie = cookies[0].split(";")[0];
    const identity = jwt.verify(
      decodeURIComponent(cookie.slice("session=".length)),
      JWT_SECRET,
    );
    assert.equal(identity.userId, stored._id.toString());
    const current = await request("/auth/me", { cookie });
    assert.equal(current.status, 200);
    assert.equal(current.body.user._id, stored._id.toString());
    assert.equal(current.body.user.password, undefined);
    assert.equal(await bcrypt.compare(payload.password, stored.password), true);

    const duplicate = await request("/auth/signup", { body: payload });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.headers["set-cookie"], undefined);
    assert.equal(users.size, 1);

    settings.auth.patientRegistrationEnabled = false;
    invalidateSettingsCache();
    const closed = await request("/auth/signup", {
      body: { ...payload, email: "closed@example.com" },
    });
    assert.equal(closed.status, 403);
    assert.equal(closed.headers["set-cookie"], undefined);
    assert.equal(users.size, 1);
    settings.auth.patientRegistrationEnabled = true;
    invalidateSettingsCache();

    const mismatch = await request("/auth/signup", {
      body: {
        ...payload,
        email: "invalid@example.com",
        confirmPassword: "Mismatch123",
      },
    });
    assert.ok(
      mismatch.status >= 400,
      "Mismatched passwords must reject signup",
    );
    assert.equal(mismatch.headers["set-cookie"], undefined);
    const noTerms = await request("/auth/signup", {
      body: { ...payload, email: "terms@example.com", acceptedTerms: false },
    });
    assert.ok(
      noTerms.status >= 400,
      "Missing terms consent must reject signup",
    );
    assert.equal(noTerms.headers["set-cookie"], undefined);
    assert.equal(users.size, 1);

    stored.isActive = false;
    assert.equal((await request("/auth/me", { cookie })).status, 403);
    const inactiveLogin = await request("/auth/login", {
      body: { email: payload.email, password: payload.password },
    });
    assert.equal(inactiveLogin.status, 403);
    assert.equal(inactiveLogin.headers["set-cookie"], undefined);
    stored.isActive = true;
    stored.removedAt = new Date();
    assert.equal((await request("/auth/me", { cookie })).status, 403);
  } finally {
    globalThis.setInterval = originalInterval;
    http.Server.prototype.listen = originalListen;
    for (const timer of intervals) clearInterval(timer);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});
