import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { parse } from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

process.env.ENV_WRITE = "on";
process.env.GOOGLE_CLIENT_SECRET = "original-secret";
process.env.CUSTOM_GOOGLE_SECRET_KEY = "custom-alias";
process.env.BREVO_API_KEY = "original-brevo";
process.env.CUSTOM_BREVO_API_KEY = "custom-brevo";

const { rewriteEnvFile } = await import("../src/services/envWriter.js");
const { ENV_PATH } = await import("../src/config/paths.js");
const { JWT_SECRET } = await import("../src/config/env.js");
const { default: Credential } =
  await import("../src/models/integrationCredentialModel.js");
const { default: User } = await import("../src/models/userModel.js");
const { default: Setting } = await import("../src/models/appSettingModel.js");
const { default: Audit } =
  await import("../src/models/settingsAuditLogModel.js");
const { default: Verification } =
  await import("../src/models/settingsVerificationModel.js");
const runtime = await import("../src/config/runtimeConfig.js");
const { encryptSecret } = await import("../src/utils/secretBox.js");
const { MANAGED_KEYS } = await import("../src/config/integrationKeys.js");

// All filesystem operations are mocked: real .env and .env.bak are never touched.
test("CUSTOM_ writes preserve defaults and unrelated values; reset removes only managed overrides", async (t) => {
  let content =
    "BREVO_API_KEY=original-brevo\nCUSTOM_BREVO_API_KEY=old-custom\nMAIL_FROM=clinic@example.com\nJWT_SECRET=untouched\nCUSTOM_UNRELATED=keep\n";
  let backup;
  let pending;
  t.mock.method(fs.promises, "readFile", async (file) => {
    assert.equal(file, ENV_PATH);
    return content;
  });
  t.mock.method(fs.promises, "stat", async () => ({ mode: 0o600 }));
  t.mock.method(fs.promises, "copyFile", async () => {
    backup = content;
  });
  t.mock.method(fs.promises, "chmod", async () => {});
  t.mock.method(fs.promises, "writeFile", async (_file, value) => {
    pending = value;
  });
  t.mock.method(fs.promises, "rename", async () => {
    content = pending;
  });
  assert.equal(
    (await rewriteEnvFile(new Map([["BREVO_API_KEY", "new-custom"]]))).outcome,
    "ok",
  );
  assert.equal(parse(backup).CUSTOM_BREVO_API_KEY, "old-custom");
  let values = parse(content);
  assert.equal(values.BREVO_API_KEY, "original-brevo");
  assert.equal(values.CUSTOM_BREVO_API_KEY, "new-custom");
  assert.equal(values.JWT_SECRET, "untouched");
  assert.equal((await rewriteEnvFile()).outcome, "ok");
  values = parse(content);
  assert.equal(values.BREVO_API_KEY, "original-brevo");
  assert.equal(values.CUSTOM_BREVO_API_KEY, undefined);
  assert.equal(values.CUSTOM_UNRELATED, "keep");
  const before = content;
  assert.equal(
    (await rewriteEnvFile(new Map([["BREVO_API_KEY", "bad\nvalue"]]))).outcome,
    "failed",
  );
  assert.equal(content, before);
});

test("Reset HTTP endpoint checks auth, confirmation and action token; defaults survive read-only restart", async (t) => {
  process.env.ENV_WRITE = "off";
  let rows = [
    {
      key: "BREVO_API_KEY",
      valueEncrypted: encryptSecret("database-custom"),
      clearedAt: null,
    },
  ];
  let writes = 0;
  let consumed = false;
  let role = "admin";
  let reconnected = false;
  const logs = [];
  t.mock.method(Credential, "find", () => ({ lean: async () => rows }));
  t.mock.method(Credential, "bulkWrite", async (operations) => {
    writes += 1;
    rows = operations.map(({ updateOne }) => ({
      key: updateOne.filter.key,
      ...updateOne.update.$set,
    }));
  });
  t.mock.method(User, "findById", () => ({
    select: async () => ({ role, isActive: true }),
  }));
  t.mock.method(User, "countDocuments", async () => 2);
  t.mock.method(User, "updateMany", async () => {
    reconnected = true;
  });
  t.mock.method(Setting, "findOneAndUpdate", async () => ({}));
  t.mock.method(Audit, "create", async (log) => {
    logs.push(log);
  });
  t.mock.method(Verification, "exists", async () => consumed);
  t.mock.method(Verification, "updateOne", async () => {
    consumed = true;
  });
  await runtime.invalidateRuntimeConfigCache();
  assert.equal(
    runtime.getIntegrationConfig("BREVO_API_KEY"),
    "database-custom",
  );
  assert.equal(
    runtime.getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
    "custom-alias",
  );
  const { default: routes } = await import("../src/routes/settingsRoutes.js");
  const app = express();
  app.use(cookieParser(), express.json());
  app.use("/admin/settings", routes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const adminId = "111111111111111111111111";
  const session = jwt.sign({ userId: adminId }, JWT_SECRET);
  const token = (action) =>
    jwt.sign(
      {
        purpose: "settings-verification",
        adminId,
        action,
        verificationId: adminId,
      },
      JWT_SECRET,
      { expiresIn: "2m" },
    );
  const request = (body, signedIn = true) =>
    fetch(
      `http://127.0.0.1:${server.address().port}/admin/settings/integrations/credentials/reset`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signedIn ? { Cookie: `session=${session}` } : {}),
        },
        body: JSON.stringify(body),
      },
    );
  try {
    assert.equal((await request({}, false)).status, 401);
    role = "secretary";
    assert.equal((await request({})).status, 403);
    role = "admin";
    assert.equal((await request({ verificationToken: "invalid" })).status, 400);
    assert.equal(
      (
        await request({
          verificationToken: token("exportBackup"),
          confirmKeyRotation: true,
        })
      ).status,
      409,
    );
    assert.equal(writes, 0);
    const payload = {
      verificationToken: token("resetIntegrationCredentials"),
      confirmKeyRotation: true,
    };
    const response = await request(payload);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.restartRequired, true);
    assert.equal(result.envWrite, "skipped_readonly");
    assert.equal(result.warnings.length, 1);
    assert.equal(rows.length, MANAGED_KEYS.size);
    assert.ok(
      rows.every(
        (row) => row.clearedAt && !row.valueEncrypted && !row.previousEncrypted,
      ),
    );
    assert.equal(
      runtime.getIntegrationConfig("BREVO_API_KEY"),
      "original-brevo",
    );
    assert.equal(runtime.getIntegrationSource("BREVO_API_KEY"), "env");
    assert.equal(
      runtime.getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
      "original-secret",
    );
    assert.equal(
      runtime.getIntegrationConfig("GOOGLE_DRIVE_ROOT_FOLDER_ID"),
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "",
    );
    await runtime.invalidateRuntimeConfigCache();
    assert.equal(
      runtime.getIntegrationConfig("BREVO_API_KEY"),
      "original-brevo",
    );
    assert.ok(reconnected);
    assert.equal(logs.length, 1);
    assert.ok(!JSON.stringify(logs).includes("database-custom"));
    assert.equal((await request(payload)).status, 409);
    assert.equal(writes, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    process.env.ENV_WRITE = "on";
  }
});
