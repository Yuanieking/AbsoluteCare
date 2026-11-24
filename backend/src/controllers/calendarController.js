import jwt from "jsonwebtoken";
import { FRONTEND_URL, JWT_SECRET } from "../config/env.js";
import {
  backfillCalendar,
  calendarAuthorizationUrl,
  connectCalendarAccount,
  disconnectCalendarAccount,
  exchangeCalendarCode,
  getCalendarStatus,
} from "../services/calendarService.js";
import { getSettings } from "../services/settingsService.js";
import { getIntegrationConfig } from "../config/runtimeConfig.js";
import { apiLink, prefersJson } from "../utils/hateoas.js";

export async function connectCalendar(req, res) {
  if (!(await getSettings()).integrations.googleCalendarEnabled) {
    res
      .status(403)
      .json({ message: "Google Calendar sync is currently disabled." });
    return;
  }
  const userId = req.patient?._id || req.user.userId;
  const role = req.patient ? "patient" : "therapist";
  const redirectUri = getIntegrationConfig("GOOGLE_CALENDAR_REDIRECT_URI");
  const value = jwt.sign(
    { purpose: "calendar", userId: userId.toString(), role, redirectUri },
    JWT_SECRET,
    { expiresIn: "10m" },
  );
  const authorizationUrl = calendarAuthorizationUrl({
    value,
    redirectUri,
  });
  res.status(200).json({
    redirectUrl: authorizationUrl,
    _links: {
      self: apiLink(req.path, "GET"),
      redirect: { href: authorizationUrl, method: "GET" },
      callback: apiLink("/integrations/google-calendar/callback", "GET"),
    },
  });
}

// Where each role connects its calendar: therapists on their availability page,
// patients in account settings.
function calendarDestination(role) {
  return role === "therapist" ? "/staff/therapist/availability" : "/settings";
}

function calendarRedirect(req, res, role, result, reason) {
  const query = new URLSearchParams({ calendar: result });
  if (reason) query.set("reason", reason);
  const destination = `${FRONTEND_URL}${calendarDestination(role)}?${query}`;
  if (prefersJson(req)) {
    res.status(result === "error" ? 400 : 200).json({
      status: result,
      ...(reason ? { reason } : {}),
      redirectUrl: destination,
      _links: {
        self: apiLink("/integrations/google-calendar/callback", "GET"),
        redirect: { href: destination, method: "GET" },
      },
    });
    return;
  }
  res.redirect(destination);
}

export async function calendarCallback(req, res) {
  const rawState = String(req.query.state || "");
  let state;
  try {
    state = jwt.verify(rawState, JWT_SECRET);
    if (state.purpose !== "calendar") throw new Error("Invalid calendar state.");
  } catch {
    // Unverified decode only chooses which of the two fixed pages to return to.
    const claimed = jwt.decode(rawState);
    calendarRedirect(req, res, claimed?.role, "error", "expired");
    return;
  }
  try {
    if (!(await getSettings()).integrations.googleCalendarEnabled) {
      calendarRedirect(req, res, state.role, "error", "disabled");
      return;
    }
    if (req.query.error) {
      calendarRedirect(
        req,
        res,
        state.role,
        "error",
        req.query.error === "access_denied" ? "denied" : "failed",
      );
      return;
    }
    const tokens = await exchangeCalendarCode(
      String(req.query.code),
      state.redirectUri || getIntegrationConfig("GOOGLE_CALENDAR_REDIRECT_URI"),
    );
    if (!tokens.refresh_token) {
      calendarRedirect(req, res, state.role, "error", "no_refresh_token");
      return;
    }
    const user = await connectCalendarAccount(state.userId, tokens);
    await backfillCalendar(user._id, String(state.role || "patient"));
    calendarRedirect(req, res, state.role, "connected");
  } catch {
    calendarRedirect(req, res, state.role, "error", "failed");
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
