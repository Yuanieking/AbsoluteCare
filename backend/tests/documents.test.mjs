import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import mongoose, { Types } from "mongoose";
import jwt from "jsonwebtoken";
import AppSetting from "../src/models/appSettingModel.js";
import Credential from "../src/models/integrationCredentialModel.js";
import Connection from "../src/models/googleDriveConnectionModel.js";
import Document from "../src/models/generatedDocumentModel.js";
import User from "../src/models/userModel.js";
import Dependent from "../src/models/dependentModel.js";
import Session from "../src/models/sessionModel.js";
import Appointment from "../src/models/appointmentModel.js";
import { encryptSecret } from "../src/utils/secretBox.js";
import { JWT_SECRET } from "../src/config/env.js";
import { invalidateRuntimeConfigCache } from "../src/config/runtimeConfig.js";
import { invalidateSettingsCache } from "../src/services/settingsService.js";
import {
  connectDrive,
  driveCallback,
} from "../src/controllers/googleDriveController.js";
import { buildDocumentPayload } from "../src/services/documentDataService.js";
import {
  attemptDriveUpload,
  retryDocument,
} from "../src/services/documentService.js";
import {
  connectClinicDrive,
  disconnectClinicDrive,
  uploadDocumentFile,
} from "../src/services/driveService.js";

mongoose.set("bufferCommands", false);
const actor = {
  id: "111111111111111111111111",
  role: "secretary",
  name: "Secretary",
};
const documentId = new Types.ObjectId();
let connection;
let overrides;
let requests;
let respond;

beforeEach(async () => {
  overrides = {
    GOOGLE_CLIENT_ID: "fake-client",
    GOOGLE_CLIENT_SECRET: "fake-secret",
    GOOGLE_DRIVE_ROOT_FOLDER_ID: "",
    GOOGLE_DRIVE_REDIRECT_URI: "https://api.example/drive/callback",
  };
  mock.method(Credential, "find", () => ({
    lean: async () =>
      Object.entries(overrides).map(([key, value]) => ({
        key,
        valueEncrypted: encryptSecret(value),
      })),
  }));
  mock.method(AppSetting, "findOne", async () => new AppSetting({}));
  invalidateSettingsCache();
  await invalidateRuntimeConfigCache();
  connection = new Connection({
    key: "clinic",
    connected: true,
    email: "clinic@example.com",
    rootFolderId: "",
    refreshTokenEncrypted: encryptSecret("fake-refresh"),
  });
  mock.method(connection, "save", async () => connection);
  mock.method(Connection, "findOne", async () => connection);
  mock.method(Connection, "updateOne", async (_filter, update) => {
    Object.assign(connection, update.$set);
    return { matchedCount: 1 };
  });
  mock.method(Connection, "findOneAndUpdate", async (_filter, update) => {
    Object.assign(connection, update.$set);
    return connection;
  });
  requests = [];
  respond = async (url) => {
    if (url.includes("oauth2"))
      return Response.json({
        access_token: "fake-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
      });
    if (url.includes("userinfo"))
      return Response.json({ email: "clinic@example.com" });
    if (url.includes("generateIds"))
      return Response.json({ ids: ["reserved-file"] });
    if (url.includes("files?q="))
      return Response.json({ files: [{ id: "folder" }] });
    if (url.includes("upload/"))
      return Response.json({
        id: "reserved-file",
        webViewLink: "https://drive.example/file",
      });
    return Response.json({
      id: "folder",
      mimeType: "application/vnd.google-apps.folder",
      trashed: false,
    });
  };
  mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url: String(url), init });
    return respond(String(url), init);
  });
  await disconnectClinicDrive();
  connection.connected = true;
  connection.refreshTokenEncrypted = encryptSecret("fake-refresh");
});
afterEach(() => {
  mock.restoreAll();
  invalidateSettingsCache();
});

function uploadInput(extra = {}) {
  return {
    trackingNumber: "VIS-2026-000001",
    type: "visit_record",
    datedAt: new Date("2026-10-10"),
    buffer: Buffer.from("fake-pdf"),
    ...extra,
  };
}
function responseRecorder() {
  return {
    redirect(value) {
      this.location = value;
    },
    json(value) {
      this.body = value;
      return this;
    },
    status(code) {
      this.code = code;
      return this;
    },
  };
}
function storeDocument() {
  const doc = new Document({
    _id: documentId,
    trackingNumber: "VIS-2026-000001",
    type: "visit_record",
    title: "Visit",
    fileId: "local-id",
    fileName: "visit.pdf",
    generatedBy: actor.id,
    generatedByRole: actor.role,
    createdAt: new Date("2026-10-10"),
    pdf: Buffer.from("fake-pdf"),
  });
  mock.method(doc, "save", async () => doc);
  mock.method(Document, "findById", () => ({
    select: async () => doc,
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  }));
  mock.method(Document, "findOneAndUpdate", async (_filter, update) => {
    if (
      doc.drive.status === "uploaded" ||
      (doc.drive.lockExpiresAt && doc.drive.lockExpiresAt > new Date())
    )
      return null;
    for (const [key, value] of Object.entries(update.$set)) doc.set(key, value);
    return doc;
  });
  mock.method(Document, "updateOne", async (filter, update) => {
    if (
      filter["drive.lockToken"] &&
      filter["drive.lockToken"] !== doc.drive.lockToken
    )
      return { matchedCount: 0 };
    for (const [key, value] of Object.entries(update.$set ?? {}))
      doc.set(key, value);
    return { matchedCount: 1 };
  });
  return doc;
}

test("Secretary retry cannot expose or mutate another issuer's document", async () => {
  const doc = storeDocument();
  doc.generatedBy = new Types.ObjectId();
  await assert.rejects(
    () => retryDocument(String(doc._id), actor),
    (error) => error.status === 404,
  );
  assert.equal(doc.save.mock.callCount(), 0);
  assert.equal(requests.length, 0);
});

test("OAuth uses runtime redirect and pins it through a configuration change", async () => {
  const res = responseRecorder();
  await connectDrive({ user: { userId: actor.id } }, res);
  const authorization = new URL(res.location);
  assert.equal(
    authorization.searchParams.get("redirect_uri"),
    overrides.GOOGLE_DRIVE_REDIRECT_URI,
  );
  const state = authorization.searchParams.get("state");
  assert.equal(
    jwt.verify(state, JWT_SECRET).redirectUri,
    overrides.GOOGLE_DRIVE_REDIRECT_URI,
  );
  overrides.GOOGLE_DRIVE_REDIRECT_URI = "https://changed.example/callback";
  await invalidateRuntimeConfigCache();
  const callback = responseRecorder();
  await driveCallback({ query: { state, code: "fake-code" } }, callback);
  const exchange = requests.find((request) => request.url.includes("oauth2"));
  assert.equal(
    exchange.init.body.get("redirect_uri"),
    "https://api.example/drive/callback",
  );
  assert.match(callback.location, /drive=connected/);
});

test("Replacing the Google account resets its stored root and cached folders", async () => {
  await uploadDocumentFile(uploadInput());
  connection.rootFolderId = "account-A-root";
  await connectClinicDrive({
    tokens: { refresh_token: "account-B-refresh" },
    adminId: actor.id,
  });
  assert.equal(connection.rootFolderId, "");
  const searches = requests.filter((request) =>
    request.url.includes("files?q="),
  ).length;
  await uploadDocumentFile(uploadInput());
  assert.ok(
    requests.filter((request) => request.url.includes("files?q=")).length >
      searches,
  );
});

test("Disconnect clears account-specific root state", async () => {
  connection.rootFolderId = "account-A-root";
  await disconnectClinicDrive();
  assert.equal(connection.rootFolderId, "");
});

test("A missing cached folder is resolved again before the retry", async () => {
  await uploadDocumentFile(uploadInput());
  let fail = true;
  const normal = respond;
  respond = async (url, init) => {
    if (url.includes("upload/") && fail) {
      fail = false;
      return new Response("", { status: 404 });
    }
    return normal(url, init);
  };
  const searches = requests.filter((request) =>
    request.url.includes("files?q="),
  ).length;
  await uploadDocumentFile(uploadInput());
  assert.ok(
    requests.filter((request) => request.url.includes("files?q=")).length >
      searches,
  );
});

test("A missing app-created root is recreated rather than retained", async () => {
  connection.rootFolderId = "deleted-root";
  const normal = respond;
  respond = async (url, init) =>
    url.includes("/files/deleted-root?")
      ? new Response("", { status: 404 })
      : normal(url, init);
  await uploadDocumentFile(uploadInput());
  assert.notEqual(connection.rootFolderId, "deleted-root");
});

for (const status of [429, 503]) {
  test(`Token HTTP ${status} remains retryable without requiring reconnect`, async () => {
    respond = async () =>
      new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
        status,
      });
    await assert.rejects(
      () => uploadDocumentFile(uploadInput()),
      (error) => error.code === "transient" && error.retryable,
    );
    assert.equal(connection.needsReconnect, false);
  });
}
test("An invalid grant requires reconnection", async () => {
  respond = async () =>
    new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
  await assert.rejects(
    () => uploadDocumentFile(uploadInput()),
    (error) => error.code === "reconnect" && !error.retryable,
  );
  assert.equal(connection.needsReconnect, true);
});

test("Dependent adherence uses a BSON ObjectId and reports matching counts", async () => {
  const patientId = new Types.ObjectId();
  const dependentId = new Types.ObjectId();
  mock.method(User, "findById", () => ({
    select: async () => ({
      _id: patientId,
      role: "user",
      firstname: "Guardian",
      lastname: "Example",
    }),
  }));
  mock.method(Dependent, "findById", async () => ({
    _id: dependentId,
    guardian: patientId,
    firstName: "Child",
    lastName: "Example",
  }));
  mock.method(Session, "find", () => {
    const q = { select: () => q, populate: () => q, sort: async () => [] };
    return q;
  });
  mock.method(Appointment, "aggregate", async (pipeline) => {
    assert.ok(pipeline[0].$match.dependent instanceof Types.ObjectId);
    assert.equal(String(pipeline[0].$match.dependent), String(dependentId));
    return [{ _id: "completed", count: 2 }];
  });
  const payload = await buildDocumentPayload(
    {
      type: "patient_summary",
      patientId: String(patientId),
      dependentId: String(dependentId),
      from: new Date("2026-10-01"),
      to: new Date("2026-10-31"),
    },
    { ...actor, role: "admin" },
  );
  assert.deepEqual(
    payload.sections.find(
      (section) => section.heading === "Appointment adherence",
    ).tables[0].rows[1],
    ["Completed", "2"],
  );
});

test("Concurrent attempts claim a document once and do not duplicate its upload", async () => {
  const doc = storeDocument();
  await Promise.all([attemptDriveUpload(doc), attemptDriveUpload(doc)]);
  assert.equal(
    requests.filter((request) => request.url.includes("upload/")).length,
    1,
  );
  assert.equal(doc.drive.status, "uploaded");
  assert.equal(doc.drive.attempts, 1);
  assert.equal(doc.drive.lockToken, "");
  assert.equal(doc.drive.lockExpiresAt, null);
});

test("A lost upload response retries the persisted Drive ID instead of creating another file", async () => {
  const doc = storeDocument();
  const normal = respond;
  let committed = false;
  respond = async (url, init) => {
    if (url.includes("upload/")) {
      assert.match(Buffer.from(init.body).toString(), /"id":"reserved-file"/);
      assert.equal(doc.drive.fileId, "reserved-file");
      if (!committed) {
        committed = true;
        throw new Error("Response lost after remote commit");
      }
      return new Response("", { status: 409 });
    }
    if (url.includes("/files/reserved-file?"))
      return Response.json({
        id: "reserved-file",
        webViewLink: "https://drive.example/file",
        parents: ["folder"],
        appProperties: { trackingNumber: doc.trackingNumber },
        trashed: false,
      });
    return normal(url, init);
  };
  await attemptDriveUpload(doc);
  assert.equal(doc.drive.status, "pending");
  await retryDocument(String(doc._id), actor);
  assert.equal(doc.drive.status, "uploaded");
  assert.equal(
    requests.filter((request) => request.url.includes("generateIds")).length,
    1,
  );
});
