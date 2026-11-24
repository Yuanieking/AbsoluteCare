import jwt from "jsonwebtoken";

import { FRONTEND_URL, JWT_SECRET } from "../config/env.js";
import { getIntegrationConfig } from "../config/runtimeConfig.js";
import {
  connectClinicDrive,
  disconnectClinicDrive,
  driveAuthorizationUrl,
  exchangeDriveCode,
  getDriveStatus,
  recordConnectFailure,
  testDriveConnection,
} from "../services/driveService.js";
import {
  effectiveIntegrationEnabled,
  getSettings,
} from "../services/settingsService.js";
import { apiLink, prefersJson } from "../utils/hateoas.js";

function settingsDestination(params) {
  const query = new URLSearchParams({ section: "integrations", ...params });
  return `${FRONTEND_URL}/staff/admin/settings?${query}`;
}

function sendDriveCallbackResult(req, res, { statusCode = 200, status, reason, destination }) {
  if (prefersJson(req)) {
    res.status(statusCode).json({
      status,
      ...(reason ? { reason } : {}),
      redirectUrl: destination,
      _links: {
        self: apiLink("/integrations/google-drive/callback", "GET"),
        redirect: { href: destination, method: "GET" },
      },
    });
    return;
  }
  res.redirect(destination);
}

export async function connectDrive(req, res) {
  if (!effectiveIntegrationEnabled(await getSettings(), "googleDrive")) {
    res
      .status(403)
      .json({ message: "Google Drive filing is currently disabled." });
    return;
  }
  const redirectUri = getIntegrationConfig("GOOGLE_DRIVE_REDIRECT_URI");
  const state = jwt.sign(
    { purpose: "drive", adminId: req.user.userId, redirectUri },
    JWT_SECRET,
    { expiresIn: "10m" },
  );
  const authorizationUrl = driveAuthorizationUrl(state, redirectUri);
  res.status(200).json({
    redirectUrl: authorizationUrl,
    _links: {
      self: apiLink("/integrations/google-drive/connect", "GET"),
      redirect: { href: authorizationUrl, method: "GET" },
      callback: apiLink("/integrations/google-drive/callback", "GET"),
    },
  });
}

export async function driveCallback(req, res) {
  try {
    const state = jwt.verify(String(req.query.state), JWT_SECRET);
    if (state.purpose !== "drive" || typeof state.redirectUri !== "string") {
      throw new Error("Invalid drive state. Start the connection again.");
    }
    const tokens = await exchangeDriveCode(
      String(req.query.code),
      state.redirectUri,
    );
    await connectClinicDrive({ tokens, adminId: String(state.adminId) });
    sendDriveCallbackResult(req, res, {
      status: "connected",
      destination: settingsDestination({ drive: "connected" }),
    });
  } catch (error) {
    const denied =
      typeof req.query.error === "string" ? req.query.error.slice(0, 60) : "";
    const reason = denied
      ? `Google refused the connection (${denied}).`
      : error instanceof Error
        ? error.message.slice(0, 120)
        : "connection_failed";
    await recordConnectFailure(reason).catch(() => undefined);
    sendDriveCallbackResult(req, res, {
      statusCode: 400,
      status: "error",
      reason,
      destination: settingsDestination({ drive: "error", reason }),
    });
  }
}

export async function driveStatus(req, res) {
  res.set("Cache-Control", "no-store");
  res.json(await getDriveStatus());
}

export async function disconnectDrive(req, res) {
  await disconnectClinicDrive();
  res.status(204).send();
}

export async function testDrive(req, res) {
  const result = await testDriveConnection();
  res.status(result.ok ? 200 : 502).json(result);
}
