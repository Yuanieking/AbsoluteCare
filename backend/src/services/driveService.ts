import crypto from "node:crypto";
import type { HydratedDocument, Types } from "mongoose";
import { FRONTEND_URL } from "../config/env.js";
import { getIntegrationConfig } from "../config/runtimeConfig.js";
import GoogleDriveConnection, {
  type GoogleDriveConnection as ConnectionData,
} from "../models/googleDriveConnectionModel.js";
import type { DocumentType } from "../models/generatedDocumentModel.js";
import { decryptSecret, encryptSecret } from "../utils/secretBox.js";
import { effectiveIntegrationEnabled, getSettings } from "./settingsService.js";
import { clinicIdentity, renderDocumentPdf } from "./documentPdfService.js";
import { verificationUrl } from "./documentNumberService.js";

type ConnectionDoc = HydratedDocument<ConnectionData>;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file openid email";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "AbsoluteCare Documents";
const TEST_FOLDER_NAME = "_connection-test";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

const TYPE_FOLDERS: Record<DocumentType, string> = {
  clinic_report: "Clinic reports",
  patient_summary: "Patient summaries",
  visit_record: "Visit records",
  receipt: "Receipts",
};

export type DriveFailureCode =
  | "not_connected"
  | "disabled"
  | "reconnect"
  | "quota"
  | "permission"
  | "folder_missing"
  | "transient"
  | "rejected"
  | "already_exists";

export class DriveError extends Error {
  code: DriveFailureCode;
  retryable: boolean;

  constructor(code: DriveFailureCode, message: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

const NOT_CONNECTED =
  "Google Drive is not connected. An admin can connect it in Settings, Integrations.";
const DISABLED =
  "Google Drive filing is switched off in Settings, Integrations.";
const REVOKED =
  "Google Drive access was revoked. Reconnect the clinic account.";

function googleClient(): { id: string; secret: string } {
  return {
    id: getIntegrationConfig("GOOGLE_CLIENT_ID"),
    secret: getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
  };
}

function objectId(value: string): Types.ObjectId {
  return value as unknown as Types.ObjectId;
}

export async function getConnection(): Promise<ConnectionDoc | null> {
  return GoogleDriveConnection.findOne({ key: "clinic" });
}

export function driveAuthorizationUrl(
  state: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: googleClient().id,
    prompt: "consent",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface DriveTokens {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export async function exchangeDriveCode(
  code: string,
  redirectUri: string,
): Promise<DriveTokens> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      code,
      client_id: googleClient().id,
      client_secret: googleClient().secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new DriveError("rejected", REVOKED, false);
  return (await response.json()) as DriveTokens;
}

async function fetchAccountEmail(accessToken: string): Promise<string> {
  try {
    const response = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) return "";
    const body = (await response.json()) as { email?: string };
    return body.email ?? "";
  } catch {
    return "";
  }
}

export async function connectClinicDrive({
  tokens,
  adminId,
}: {
  tokens: DriveTokens;
  adminId: string;
}): Promise<ConnectionDoc> {
  if (!tokens.refresh_token) {
    throw new DriveError(
      "rejected",
      "Google did not return a refresh token. Remove the app from the clinic account's permissions and connect again.",
      false,
    );
  }
  const email = tokens.access_token
    ? await fetchAccountEmail(tokens.access_token)
    : "";
  resetDriveCaches();
  const connection = await GoogleDriveConnection.findOneAndUpdate(
    { key: "clinic" },
    {
      $set: {
        connected: true,
        email,
        refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
        connectedAt: new Date(),
        connectedBy: objectId(adminId),
        needsReconnect: false,
        lastError: "",
        rootFolderId: "",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return connection as unknown as ConnectionDoc;
}

export async function disconnectClinicDrive(): Promise<void> {
  resetDriveCaches();
  await GoogleDriveConnection.updateOne(
    { key: "clinic" },
    {
      $set: {
        connected: false,
        rootFolderId: "",
        refreshTokenEncrypted: "",
        email: "",
        needsReconnect: false,
        lastError: "",
      },
    },
  );
}

export interface DriveStatusView {
  connected: boolean;
  email: string;
  connectedAt: Date | null;
  needsReconnect: boolean;
  rootFolderName: string;
  lastError: string;
}

export async function getDriveStatus(): Promise<DriveStatusView> {
  const connection = await getConnection();
  return {
    connected: Boolean(
      connection?.connected && connection.refreshTokenEncrypted,
    ),
    email: connection?.email ?? "",
    connectedAt: connection?.connectedAt ?? null,
    needsReconnect: Boolean(connection?.needsReconnect),
    rootFolderName: ROOT_FOLDER_NAME,
    lastError: connection?.lastError ?? "",
  };
}

// The callback redirect cannot carry the reason to an admin who closed the tab,
// so keep it on the connection where the settings card can read it.
export async function recordConnectFailure(reason: string): Promise<void> {
  await GoogleDriveConnection.findOneAndUpdate(
    { key: "clinic" },
    { $set: { lastError: reason.slice(0, 300) } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

export async function markConnectionError(error: unknown): Promise<void> {
  if (!(error instanceof DriveError)) return;
  await GoogleDriveConnection.updateOne(
    { key: "clinic" },
    {
      $set: {
        lastError: error.message,
        ...(error.code === "reconnect" ? { needsReconnect: true } : {}),
      },
    },
  );
}

let accessTokenCache: {
  value: string;
  expiresAt: number;
  credential: string;
} | null = null;

async function accessToken(connection: ConnectionDoc): Promise<string> {
  if (
    accessTokenCache?.credential === connection.refreshTokenEncrypted &&
    accessTokenCache.expiresAt > Date.now()
  ) {
    return accessTokenCache.value;
  }
  const generation = cacheGeneration;
  const refreshToken = decryptSecret(connection.refreshTokenEncrypted);
  if (!refreshToken)
    throw new DriveError("not_connected", NOT_CONNECTED, false);
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      body: new URLSearchParams({
        client_id: googleClient().id,
        client_secret: googleClient().secret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new DriveError(
      "transient",
      "Google Drive is temporarily unavailable. Retrying.",
      true,
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (
      response.status === 429 ||
      response.status >= 500 ||
      body.error === "temporarily_unavailable" ||
      body.error === "server_error"
    ) {
      throw new DriveError(
        "transient",
        "Google Drive is temporarily unavailable. Retrying.",
        true,
      );
    }
    if (body.error === "invalid_grant" || response.status === 401) {
      await GoogleDriveConnection.updateOne(
        { key: "clinic" },
        { $set: { needsReconnect: true, lastError: REVOKED } },
      );
      throw new DriveError("reconnect", REVOKED, false);
    }
    throw new DriveError(
      "rejected",
      "Google rejected the Drive credentials. Check the OAuth client configuration.",
      false,
    );
  }
  const body = (await response.json()) as DriveTokens;
  if (!body.access_token) {
    throw new DriveError(
      "transient",
      "Google Drive did not return an access token. Retrying.",
      true,
    );
  }
  if (generation === cacheGeneration) {
    accessTokenCache = {
      value: body.access_token,
      expiresAt:
        Date.now() + Math.max((body.expires_in ?? 3600) - 60, 0) * 1000,
      credential: connection.refreshTokenEncrypted,
    };
  }
  return body.access_token;
}

async function classify(response: Response): Promise<DriveError> {
  const body = await response.text().catch(() => "");
  if (response.status === 409)
    return new DriveError(
      "already_exists",
      "The reserved Drive file already exists.",
      false,
    );
  if (response.status === 401)
    return new DriveError("reconnect", REVOKED, false);
  if (response.status === 403 && body.includes("storageQuotaExceeded")) {
    return new DriveError(
      "quota",
      "The clinic Google Drive is out of storage. Free space or change the account.",
      false,
    );
  }
  if (response.status === 403) {
    return new DriveError(
      "permission",
      "The app cannot write to the configured folder.",
      false,
    );
  }
  if (response.status === 404) {
    return new DriveError(
      "folder_missing",
      "The Drive folder moved. The app will recreate it.",
      true,
    );
  }
  if (response.status === 429 || response.status >= 500) {
    return new DriveError(
      "transient",
      "Google Drive is temporarily unavailable. Retrying.",
      true,
    );
  }
  return new DriveError(
    "rejected",
    `Google Drive rejected this file. ${body.slice(0, 200)}`.trim(),
    false,
  );
}

async function driveFetch(
  connection: ConnectionDoc,
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: Uint8Array;
  } = {},
): Promise<Response> {
  const token = await accessToken(connection);
  let response: Response;
  try {
    const request: RequestInit = {
      method: init.method ?? "GET",
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    };
    if (init.body) request.body = init.body;
    response = await fetch(url, request);
  } catch {
    throw new DriveError(
      "transient",
      "Google Drive is temporarily unavailable. Retrying.",
      true,
    );
  }
  if (response.ok) return response;
  throw await classify(response);
}

const folderCache = new Map<string, { id: string; expiresAt: number }>();
const pendingFolders = new Map<string, Promise<string>>();
let cacheGeneration = 0;

function resetDriveCaches(): void {
  cacheGeneration += 1;
  accessTokenCache = null;
  folderCache.clear();
  pendingFolders.clear();
}

async function findFolder(
  connection: ConnectionDoc,
  name: string,
  parentId: string,
): Promise<string | null> {
  const query = `name = '${name.replaceAll("'", "\\'")}' and '${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const response = await driveFetch(
    connection,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&pageSize=1`,
  );
  const body = (await response.json()) as { files?: Array<{ id?: string }> };
  return body.files?.[0]?.id ?? null;
}

async function createFolder(
  connection: ConnectionDoc,
  name: string,
  parentId: string,
): Promise<string> {
  const response = await driveFetch(
    connection,
    "https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new TextEncoder().encode(
        JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
      ),
    },
  );
  const body = (await response.json()) as { id?: string };
  if (!body.id) {
    throw new DriveError(
      "rejected",
      "Google Drive did not create the folder.",
      true,
    );
  }
  return body.id;
}

async function ensureFolder(
  connection: ConnectionDoc,
  name: string,
  parentId: string,
): Promise<string> {
  const account = crypto
    .createHash("sha256")
    .update(connection.refreshTokenEncrypted)
    .digest("hex");
  const key = `${account}:${parentId}:${name}`;
  const cached = folderCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.id;
  // One create per folder name even when two uploads race.
  const inflight = pendingFolders.get(key);
  if (inflight) return inflight;
  const generation = cacheGeneration;
  const task = (async () => {
    const id =
      (await findFolder(connection, name, parentId)) ??
      (await createFolder(connection, name, parentId));
    if (generation === cacheGeneration) {
      folderCache.set(key, { id, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return id;
  })();
  pendingFolders.set(key, task);
  try {
    return await task;
  } finally {
    if (pendingFolders.get(key) === task) pendingFolders.delete(key);
  }
}

function clinicDate(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

async function ensureRootFolder(connection: ConnectionDoc): Promise<string> {
  // An upload started before reconnect must not overwrite the new account's root.
  connection.$where = {
    refreshTokenEncrypted: connection.refreshTokenEncrypted,
  };
  if (connection.rootFolderId) {
    try {
      const response = await driveFetch(
        connection,
        `https://www.googleapis.com/drive/v3/files/${connection.rootFolderId}?fields=id,mimeType,trashed&supportsAllDrives=true`,
      );
      const folder = (await response.json()) as {
        trashed?: boolean;
        mimeType?: string;
      };
      if (!folder.trashed && folder.mimeType === FOLDER_MIME)
        return connection.rootFolderId;
    } catch (error) {
      if (!(error instanceof DriveError) || error.code !== "folder_missing")
        throw error;
    }
    connection.rootFolderId = "";
    await connection.save();
    folderCache.clear();
  }
  const configured = getIntegrationConfig("GOOGLE_DRIVE_ROOT_FOLDER_ID").trim();
  if (configured) {
    try {
      await driveFetch(
        connection,
        `https://www.googleapis.com/drive/v3/files/${configured}?fields=id&supportsAllDrives=true`,
      );
    } catch (error) {
      if (error instanceof DriveError && error.code === "folder_missing") {
        throw new DriveError(
          "permission",
          "The configured Drive folder is not visible to this app. Clear GOOGLE_DRIVE_ROOT_FOLDER_ID so the app can create its own folder.",
          false,
        );
      }
      throw error;
    }
    connection.rootFolderId = configured;
    await connection.save();
    return configured;
  }
  // drive.file can only see folders this app created, so it makes its own root.
  const id = await ensureFolder(connection, ROOT_FOLDER_NAME, "root");
  connection.rootFolderId = id;
  await connection.save();
  console.log(`drive: created root folder "${ROOT_FOLDER_NAME}"`);
  return id;
}

interface UploadedFile {
  fileId: string;
  webViewLink: string;
  folderId: string;
  fileName: string;
}

async function uploadToFolder(
  connection: ConnectionDoc,
  buffer: Buffer,
  folderId: string,
  fileName: string,
  metadata: Record<string, unknown>,
  fileId?: string,
): Promise<UploadedFile> {
  const boundary = `absolutecare${crypto.randomUUID().replaceAll("-", "")}`;
  const payload = JSON.stringify({
    ...(fileId ? { id: fileId } : {}),
    name: fileName,
    parents: [folderId],
    mimeType: "application/pdf",
    ...metadata,
  });
  const body = new Uint8Array(
    Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${payload}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]),
  );
  let response: Response;
  try {
    response = await driveFetch(
      connection,
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,name,size",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
  } catch (error) {
    if (
      !(error instanceof DriveError) ||
      error.code !== "already_exists" ||
      !fileId
    )
      throw error;
    // A prior attempt may have committed before its response was lost.
    const existing = await driveFetch(
      connection,
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,webViewLink,parents,appProperties,trashed&supportsAllDrives=true`,
    );
    const file = (await existing.json()) as {
      id: string;
      webViewLink?: string;
      parents?: string[];
      appProperties?: { trackingNumber?: string };
      trashed?: boolean;
    };
    const properties = metadata.appProperties as
      | { trackingNumber?: string }
      | undefined;
    if (
      file.trashed ||
      file.appProperties?.trackingNumber !== properties?.trackingNumber
    ) {
      throw new DriveError(
        "rejected",
        "The reserved Drive file is unavailable. Contact the clinic administrator.",
        false,
      );
    }
    return {
      fileId: file.id,
      webViewLink: file.webViewLink ?? "",
      folderId: file.parents?.[0] ?? folderId,
      fileName,
    };
  }
  const result = (await response.json()) as {
    id?: string;
    webViewLink?: string;
  };
  if (!result.id)
    throw new DriveError(
      "transient",
      "Google Drive did not confirm the uploaded file. Retrying.",
      true,
    );
  return {
    fileId: result.id ?? "",
    webViewLink: result.webViewLink ?? "",
    folderId,
    fileName,
  };
}

export async function reserveDriveFileId(): Promise<string> {
  const connection = await getConnection();
  if (!connection?.connected)
    throw new DriveError("not_connected", NOT_CONNECTED, false);
  const response = await driveFetch(
    connection,
    "https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files",
  );
  const body = (await response.json()) as { ids?: string[] };
  const id = body.ids?.[0];
  if (!id)
    throw new DriveError(
      "transient",
      "Google Drive did not allocate a file ID. Retrying.",
      true,
    );
  return id;
}

export interface UploadDocumentInput {
  fileId?: string;
  trackingNumber: string;
  type: DocumentType;
  datedAt: Date;
  buffer: Buffer;
}

export async function uploadDocumentFile(
  input: UploadDocumentInput,
): Promise<UploadedFile> {
  const settings = await getSettings();
  if (!effectiveIntegrationEnabled(settings, "googleDrive")) {
    throw new DriveError("disabled", DISABLED, false);
  }
  const connection = await getConnection();
  if (!connection?.connected) {
    throw new DriveError("not_connected", NOT_CONNECTED, false);
  }
  // One immediate recovery pass handles stale cached folders. Further failures
  // use the persisted queue's normal backoff rather than a tight retry loop.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const root = await ensureRootFolder(connection);
      const typeFolder = await ensureFolder(
        connection,
        TYPE_FOLDERS[input.type],
        root,
      );
      const month = new Intl.DateTimeFormat("en-CA", {
        timeZone: settings.general.timezone || "Asia/Manila",
        year: "numeric",
        month: "2-digit",
      }).format(input.datedAt);
      const monthFolder = await ensureFolder(connection, month, typeFolder);
      const fileName = `${input.trackingNumber}_${clinicDate(input.datedAt, settings.general.timezone || "Asia/Manila")}.pdf`;
      return await uploadToFolder(
        connection,
        input.buffer,
        monthFolder,
        fileName,
        {
          description: `AbsoluteCare document ${input.trackingNumber}`,
          appProperties: {
            trackingNumber: input.trackingNumber,
            documentType: input.type,
          },
        },
        input.fileId,
      );
    } catch (error) {
      if (!(error instanceof DriveError) || error.code !== "folder_missing")
        throw error;
      folderCache.clear();
      pendingFolders.clear();
      cacheGeneration += 1;
      if (attempt >= 1) throw error;
    }
  }
}

async function trashFile(
  connection: ConnectionDoc,
  fileId: string,
): Promise<void> {
  await driveFetch(
    connection,
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id&supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: new TextEncoder().encode(JSON.stringify({ trashed: true })),
    },
  );
}

export interface DriveTestResult {
  ok: boolean;
  message: string;
  fileName?: string;
  webViewLink?: string;
}

export async function testDriveConnection(): Promise<DriveTestResult> {
  try {
    const settings = await getSettings();
    if (!effectiveIntegrationEnabled(settings, "googleDrive")) {
      throw new DriveError("disabled", DISABLED, false);
    }
    const connection = await getConnection();
    if (!connection?.connected) {
      throw new DriveError("not_connected", NOT_CONNECTED, false);
    }
    const now = new Date();
    const buffer = await renderDocumentPdf({
      payload: {
        type: "visit_record",
        title: "Google Drive connection test",
        subject: "Connection test",
        sections: [
          {
            paragraphs: [
              "This test file confirms that the clinic Google Drive is connected and writable.",
              "It is removed from Drive right after the upload.",
            ],
          },
        ],
        patient: null,
        dependent: null,
        appointment: null,
        rangeFrom: null,
        rangeTo: null,
      },
      trackingNumber: "TEST",
      verificationUrl: verificationUrl("TEST", FRONTEND_URL),
      verifyIsPublic: false,
      issuedLabel: "Connection test",
      issuerLine: "Issued by the clinic administrator",
      clinic: clinicIdentity(settings.general),
    });
    const root = await ensureRootFolder(connection);
    const folderId = await ensureFolder(connection, TEST_FOLDER_NAME, root);
    const fileName = `connection-test_${clinicDate(now, settings.general.timezone || "Asia/Manila")}.pdf`;
    const uploaded = await uploadToFolder(
      connection,
      buffer,
      folderId,
      fileName,
      {
        description: "AbsoluteCare Drive connection test",
      },
    );
    await trashFile(connection, uploaded.fileId);
    await GoogleDriveConnection.updateOne(
      { key: "clinic" },
      { $set: { lastError: "" } },
    );
    return {
      ok: true,
      message:
        "Google Drive is connected and writable. The test file was removed.",
      fileName,
      webViewLink: uploaded.webViewLink,
    };
  } catch (error) {
    const driveError =
      error instanceof DriveError
        ? error
        : new DriveError(
            "transient",
            "Google Drive is temporarily unavailable. Retrying.",
            true,
          );
    await markConnectionError(driveError);
    return { ok: false, message: driveError.message };
  }
}
