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

export async function connectCalendar(req, res) {
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

export async function calendarCallback(req, res) {
  try {
    if (!(await getSettings()).integrations.googleCalendarEnabled) {
      res
        .status(403)
        .json({ message: "Google Calendar sync is currently disabled." });
      return;
    }
    const state = jwt.verify(String(req.query.state), JWT_SECRET);
    if (state.purpose !== "calendar")
      throw new Error("Invalid calendar state.");
    const tokens = await exchangeCalendarCode(
      String(req.query.code),
      GOOGLE_CALENDAR_REDIRECT_URI,
    );
    if (!tokens.refresh_token)
      throw new Error("Google did not provide a refresh token.");
    const user = await connectCalendarAccount(state.userId, tokens);
    await backfillCalendar(user._id, String(state.role || "patient"));
    const destination =
      state.role === "therapist" ? "/staff/therapist/profile" : "/settings";
    res.redirect(`${FRONTEND_URL}${destination}?calendar=connected`);
  } catch {
    res.redirect(`${FRONTEND_URL}/settings?calendar=error`);
  }
}

export async function calendarStatus(req, res) {
  const userId = req.patient?._id || req.user.userId;
  res.json(await getCalendarStatus(userId));
}

export async function disconnectCalendar(req, res) {
  await disconnectCalendarAccount(req.patient?._id || req.user.userId);
  res.status(204).send();
}
