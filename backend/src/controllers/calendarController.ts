import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  FRONTEND_URL,
  GOOGLE_CALENDAR_REDIRECT_URI,
  JWT_SECRET,
} from "../config/env.js";
import {
  backfillCalendar,
  calendarAuthorizationUrl,
  connectCalendarAccount,
  disconnectCalendarAccount,
  exchangeCalendarCode,
  getCalendarStatus,
} from "../services/calendarService.js";
import { getSettings } from "../services/settingsService.js";

export async function connectCalendar(
  req: Request,
  res: Response,
): Promise<void> {
  if (!(await getSettings()).integrations.googleCalendarEnabled) {
    res
      .status(403)
      .json({ message: "Google Calendar sync is currently disabled." });
    return;
  }
  const userId = req.patient?._id || req.user.userId;
  const role = req.patient ? "patient" : "therapist";
  const value = jwt.sign(
    { purpose: "calendar", userId: userId.toString(), role },
    JWT_SECRET,
    { expiresIn: "10m" },
  );
  res.redirect(
    calendarAuthorizationUrl({
      value,
      redirectUri: GOOGLE_CALENDAR_REDIRECT_URI,
    }),
  );
}

export async function calendarCallback(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!(await getSettings()).integrations.googleCalendarEnabled) {
      res
        .status(403)
        .json({ message: "Google Calendar sync is currently disabled." });
      return;
    }
    const state = jwt.verify(
      String(req.query.state),
      JWT_SECRET,
    ) as jwt.JwtPayload;
    if (state.purpose !== "calendar")
      throw new Error("Invalid calendar state.");
    const tokens = await exchangeCalendarCode(
      String(req.query.code),
      GOOGLE_CALENDAR_REDIRECT_URI,
    );
    if (!tokens.refresh_token)
      throw new Error("Google did not provide a refresh token.");
    const user = await connectCalendarAccount(state.userId as string, tokens);
    await backfillCalendar(user._id, String(state.role || "patient"));
    const destination =
      state.role === "therapist" ? "/staff/therapist/profile" : "/settings";
    res.redirect(`${FRONTEND_URL}${destination}?calendar=connected`);
  } catch {
    res.redirect(`${FRONTEND_URL}/settings?calendar=error`);
  }
}

export async function calendarStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.patient?._id || req.user.userId;
  res.json(await getCalendarStatus(userId));
}

export async function disconnectCalendar(
  req: Request,
  res: Response,
): Promise<void> {
  await disconnectCalendarAccount(req.patient?._id || req.user.userId);
  res.status(204).send();
}
