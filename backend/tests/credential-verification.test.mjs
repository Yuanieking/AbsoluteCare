import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";

process.env.INTEGRATION_VALIDATION = "on";

test("Consumed verification tokens are refused and Drive checks the Google client", async () => {
  const { JWT_SECRET } = await import("../src/config/env.js");
  const { default: SettingsVerification } =
    await import("../src/models/settingsVerificationModel.js");
  const { verifySettingsToken } =
    await import("../src/services/verificationActions.js");
  const { validateGroup } =
    await import("../src/services/providerValidation.js");

  const action = "rotateIntegrationCredentials:email";
  const token = jwt.sign(
    {
      purpose: "settings-verification",
      adminId: "admin1",
      action,
      verificationId: "65a000000000000000000001",
    },
    JWT_SECRET,
    { expiresIn: "2m" },
  );

  let consumed = false;
  SettingsVerification.exists = async () => (consumed ? { _id: "x" } : null);
  assert.ok(await verifySettingsToken("admin1", action, token));
  assert.equal(await verifySettingsToken("admin2", action, token), null);
  consumed = true;
  assert.equal(await verifySettingsToken("admin1", action, token), null);

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "invalid_client" }));
  const drive = await validateGroup("googleDrive", {
    GOOGLE_CLIENT_ID: "123456-abc.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "wrong",
    GOOGLE_DRIVE_REDIRECT_URI: "https://example.com/cb",
  });
  assert.equal(drive.ok, false);

  const { keyDefinition, validateValue } =
    await import("../src/config/integrationKeys.js");
  const site = keyDefinition("RECAPTCHA_SITE_KEY");
  const good = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
  assert.equal(validateValue(site, good), null);
  assert.ok(validateValue(site, `asdc${good}`));
  globalThis.fetch = async () => new Response("{}");
  const recaptcha = await validateGroup("recaptcha", {
    RECAPTCHA_SITE_KEY: `asdc${good}`,
    RECAPTCHA_SECRET_KEY: good,
  });
  assert.equal(recaptcha.ok, false);
  assert.ok(recaptcha.fields.RECAPTCHA_SITE_KEY);

  // A wrong legacy GOOGLE_SECRET_KEY must not pass on the old client secret.
  const { default: Credential } =
    await import("../src/models/integrationCredentialModel.js");
  const { saveCredentials } =
    await import("../src/services/integrationCredentialService.js");
  Credential.find = () => ({ lean: async () => [] });
  process.env.GOOGLE_CLIENT_ID = "123456-abc.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "GOCSPX-good-secret";
  globalThis.fetch = async (_url, { body }) =>
    new Response(
      JSON.stringify({
        error:
          body.get("client_secret") === "GOCSPX-good-secret"
            ? "invalid_grant"
            : "invalid_client",
      }),
    );
  await assert.rejects(
    saveCredentials({
      group: "google",
      values: { GOOGLE_SECRET_KEY: "GOCSPX-wrong-alias" },
      adminId: "admin1",
      dryRun: true,
    }),
    { code: "INVALID_CREDENTIALS" },
  );
});
