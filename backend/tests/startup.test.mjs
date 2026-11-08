import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import mongoose from "mongoose";
import http from "node:http";

// Load the real compiled ESM startup, replacing persistence and outbound HTTP.
// No clinic database, email provider or Google account is contacted.
test("Compiled native-ESM startup serves document authorization and public verification", async () => {
  process.env.PORT = "0";
  process.env.NODE_ENV = "production";
  process.env.ADMIN_EMAILS = "";
  process.env.BREVO_API_KEY = "";
  process.env.MAIL_FROM = "";
  const { default: Setting } =
    await import("../dist/src/models/appSettingModel.js");
  const { default: Credential } =
    await import("../dist/src/models/integrationCredentialModel.js");
  const { default: Document } =
    await import("../dist/src/models/generatedDocumentModel.js");
  const { default: User } = await import("../dist/src/models/userModel.js");
  const { JWT_SECRET } = await import("../dist/src/config/env.js");
  const { default: jwt } = await import("jsonwebtoken");
  const settings = new Setting({
    notifications: { remindersEnabled: false },
    integrations: { googleDriveEnabled: false },
  });
  mongoose.connect = async () => mongoose;
  Setting.findOne = async () => settings;
  Credential.find = () => {
    const q = { select: () => q, lean: async () => [] };
    return q;
  };
  const issuer = "111111111111111111111111";
  User.findById = () => ({
    select: async () => ({
      _id: issuer,
      firstname: "Secretary",
      lastname: "Example",
      role: "secretary",
      isActive: true,
    }),
  });
  Document.findById = () => ({
    select: async () =>
      new Document({ generatedBy: "222222222222222222222222" }),
  });
  Document.findOne = () => ({ select: async () => null });
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
    await import("../dist/src/app.js");
    if (!server.listening) await once(server, "listening");
    const port = server.address().port;
    async function request(path, headers = {}, method = "GET") {
      return new Promise((resolve, reject) => {
        const req = http.request(
          { hostname: "127.0.0.1", port, path, method, headers },
          (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              body += chunk;
            });
            res.on("end", () =>
              resolve({
                status: res.statusCode,
                body: JSON.parse(body),
                headers: res.headers,
              }),
            );
          },
        );
        req.on("error", reject);
        req.end();
      });
    }
    const unknown = await request("/verify/VIS-2026-000001");
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.body, { status: "not_found" });
    assert.equal(unknown.headers["cache-control"], "no-store");
    assert.equal((await request("/documents")).status, 401);
    const session = jwt.sign({ userId: issuer, role: "secretary" }, JWT_SECRET);
    const retry = await request(
      "/documents/333333333333333333333333/retry",
      { Cookie: `session=${session}` },
      "POST",
    );
    assert.equal(retry.status, 404);
    assert.deepEqual(retry.body, { message: "Document not found." });
  } finally {
    globalThis.setInterval = originalInterval;
    http.Server.prototype.listen = originalListen;
    for (const timer of intervals) clearInterval(timer);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});
