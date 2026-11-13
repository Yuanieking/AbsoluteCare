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

function settingsDestination(params) {
  const query = new URLSearchParams({ section: "integrations", ...params });
  return `${FRONTEND_URL}/staff/admin/settings?${query}`;
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
  res.redirect(driveAuthorizationUrl(state, redirectUri));
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
    res.redirect(settingsDestination({ drive: "connected" }));
  } catch (error) {
    const denied =
      typeof req.query.error === "string" ? req.query.error.slice(0, 60) : "";
    const reason = denied
      ? `Google refused the connection (${denied}).`
      : error instanceof Error
        ? error.message.slice(0, 120)
        : "connection_failed";
    await recordConnectFailure(reason).catch(() => undefined);
    res.redirect(settingsDestination({ drive: "error", reason }));
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
