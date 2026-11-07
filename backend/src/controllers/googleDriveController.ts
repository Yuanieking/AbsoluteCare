import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import {
  FRONTEND_URL,
  JWT_SECRET,
} from "../config/env.js";
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

function settingsDestination(params: Record<string, string>): string {
  const query = new URLSearchParams({ section: "integrations", ...params });
  return `${FRONTEND_URL}/staff/admin/settings?${query}`;
}

export async function connectDrive(
  req: Request,
  res: Response,
): Promise<void> {
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

export async function driveCallback(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const state = jwt.verify(
      String(req.query.state),
      JWT_SECRET,
    ) as jwt.JwtPayload;
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

export async function driveStatus(
  req: Request,
  res: Response,
): Promise<void> {
  res.set("Cache-Control", "no-store");
  res.json(await getDriveStatus());
}

export async function disconnectDrive(
  req: Request,
  res: Response,
): Promise<void> {
  await disconnectClinicDrive();
  res.status(204).send();
}

export async function testDrive(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await testDriveConnection();
  res.status(result.ok ? 200 : 502).json(result);
}
