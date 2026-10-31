import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import {
  FRONTEND_URL,
  GOOGLE_CALENDAR_REDIRECT_URI,
  JWT_SECRET,
} from "../config/env.js";
import {
  backfillCalendar,
  calendarAuthorizationUrl,
  exchangeCalendarCode,
  encrypt,
} from "../services/calendarService.js";
import { getSettings } from "../services/settingsService.js";

export async function connectCalendar(req, res) {
  if (!(await getSettings()).integrations.googleCalendarEnabled) {
    return res
      .status(403)
      .json({ message: "Google Calendar sync is currently disabled." });
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
      return res
        .status(403)
        .json({ message: "Google Calendar sync is currently disabled." });
    }
    const state = jwt.verify(req.query.state, JWT_SECRET);
    if (state.purpose !== "calendar")
      throw new Error("Invalid calendar state.");
    const tokens = await exchangeCalendarCode(
      req.query.code,
      GOOGLE_CALENDAR_REDIRECT_URI,
    );
    if (!tokens.refresh_token)
      throw new Error("Google did not provide a refresh token.");
    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );
    const profile = profileResponse.ok ? await profileResponse.json() : null;
    const user = await User.findByIdAndUpdate(
      state.userId,
      {
        "googleCalendar.connected": true,
        "googleCalendar.email": profile?.email || "Connected Google account",
        "googleCalendar.refreshTokenEncrypted": encrypt(tokens.refresh_token),
        "googleCalendar.connectedAt": new Date(),
      },
      { new: true },
    );
    await backfillCalendar(user._id, state.role);
    const destination =
      state.role === "therapist" ? "/staff/therapist/profile" : "/settings";
    res.redirect(`${FRONTEND_URL}${destination}?calendar=connected`);
  } catch {
    res.redirect(`${FRONTEND_URL}/settings?calendar=error`);
  }
}

export function calendarStatus(req, res) {
  const userId = req.patient?._id || req.user.userId;
  User.findById(userId)
    .select("googleCalendar")
    .then((user) => {
      const calendar = user?.googleCalendar || {};
      res.json({
        connected: Boolean(calendar.connected),
        email: calendar.email || "",
        connectedAt: calendar.connectedAt || null,
      });
    });
}

export async function disconnectCalendar(req, res) {
  await User.updateOne(
    { _id: req.patient?._id || req.user.userId },
    {
      "googleCalendar.connected": false,
      "googleCalendar.email": "",
      "googleCalendar.refreshTokenEncrypted": "",
    },
  );
  res.status(204).send();
}
