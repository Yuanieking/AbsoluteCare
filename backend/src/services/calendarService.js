import crypto from "node:crypto";

import Appointment from "../models/appointmentModel.js";
import User from "../models/userModel.js";
import { getSettings } from "./settingsService.js";
import { CLINIC_ADDRESS } from "../config/env.js";
import { getIntegrationConfig } from "../config/runtimeConfig.js";

// ponytail: one cached key derivation, keyed by the material itself, so a
// rotated GOOGLE_CALENDAR_ENCRYPTION_KEY is picked up without a restart and
// old tokens fail to decrypt instead of silently decrypting with the new key.
let cipherKey = {
  material: "",
  key: null,
};

function encryptionKey() {
  const material = getIntegrationConfig("GOOGLE_CALENDAR_ENCRYPTION_KEY");
  if (cipherKey.material !== material) {
    cipherKey = {
      material,
      key: crypto.createHash("sha256").update(material).digest(),
    };
  }
  return cipherKey.key;
}

function googleClient() {
  return {
    id: getIntegrationConfig("GOOGLE_CLIENT_ID"),
    secret: getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
  };
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(value) {
  const [ivHex, tagHex, dataHex] = String(value || "").split(":");
  if (!ivHex || !tagHex || !dataHex)
    throw new Error("Google Calendar authorization has expired.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function calendarAuthorizationUrl(state) {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: googleClient().id,
    prompt: "consent",
    redirect_uri: state.redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    state: state.value,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCalendarCode(code, redirectUri) {
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
  });
  if (!response.ok) throw new Error("Google Calendar authorization failed.");
  return await response.json();
}

async function accessToken(user) {
  const refreshToken = decrypt(user.googleCalendar.refreshTokenEncrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: googleClient().id,
      client_secret: googleClient().secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok)
    throw new Error("Google Calendar authorization has expired.");
  const body = await response.json();
  // Google always returns access_token on a successful refresh; the cast keeps
  // today's "Bearer undefined" behaviour if it ever does not.
  return body.access_token;
}

async function calendarRequest(user, path, options = {}) {
  try {
    const token = await accessToken(user);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary${path}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (response.status === 401)
      throw new Error("Google Calendar authorization has expired.");
    if (!response.ok) throw new Error("Google Calendar request failed.");
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    await User.updateOne(
      { _id: user._id },
      { "googleCalendar.connected": false },
    );
    throw error;
  }
}

function eventPayload(appointment) {
  return {
    summary: `${appointment.service?.name || "Therapy session"} · AbsoluteCare`,
    location: CLINIC_ADDRESS,
    description: `Therapist: ${appointment.therapist ? `${appointment.therapist.firstname} ${appointment.therapist.lastname}` : "To be assigned"}`,
    start: {
      // Guarded by the caller's null check on scheduledStart/scheduledEnd.
      dateTime: appointment.scheduledStart.toISOString(),
      timeZone: "Asia/Manila",
    },
    end: {
      dateTime: appointment.scheduledEnd.toISOString(),
      timeZone: "Asia/Manila",
    },
  };
}

export async function syncConfirmedAppointment(
  appointmentId,
  calendarUserId = null,
) {
  if (!(await getSettings()).integrations.googleCalendarEnabled) return null;
  const appointment = await Appointment.findById(appointmentId).populate([
    "service",
    "therapist",
  ]);
  if (
    !appointment ||
    appointment.status !== "confirmed" ||
    !appointment.scheduledStart ||
    !appointment.scheduledEnd
  )
    return null;
  // populate() replaces ObjectId refs with documents at runtime.
  const populated = appointment;
  const user = await User.findById(calendarUserId || appointment.patient);
  if (!user?.googleCalendar?.connected) return null;
  const isTherapistCalendar = Boolean(calendarUserId);
  const eventId = isTherapistCalendar
    ? populated.therapistGoogleEventId
    : populated.googleEventId;
  const payload = eventPayload(populated);
  const event = eventId
    ? await calendarRequest(user, `/${encodeURIComponent(eventId)}`, {
        body: JSON.stringify(payload),
        method: "PUT",
      })
    : await calendarRequest(user, "", {
        body: JSON.stringify(payload),
        method: "POST",
      });
  if (!eventId && event?.id) {
    if (isTherapistCalendar) populated.therapistGoogleEventId = event.id;
    else {
      populated.googleEventId = event.id;
      populated.googleEventLink = event.htmlLink || "";
    }
    // ** Concurrency: calendar bookkeeping keeps updatedAt unchanged so the
    // ** timestamp the client just received stays valid for its next If-Match write.
    await populated.save({ timestamps: false });
  }
  return event;
}

// Accepts both a plain Appointment doc and a populated one (patient/therapist
// are documents at runtime); only their ids and event ids are used.
function ownerId(value) {
  if (!value) return null;
  return typeof value === "object" && "_id" in value ? value._id : value;
}

export async function deleteCalendarEvent(appointment) {
  if (!(await getSettings()).integrations.googleCalendarEnabled) return;
  const calendars = [
    [ownerId(appointment.patient), appointment.googleEventId, "googleEventId"],
    [
      ownerId(appointment.therapist),
      appointment.therapistGoogleEventId,
      "therapistGoogleEventId",
    ],
  ];
  for (const [userId, eventId, field] of calendars) {
    const user = await User.findById(userId);
    if (!user?.googleCalendar?.connected || !eventId) continue;
    await calendarRequest(user, `/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
    if (field === "googleEventId") appointment.googleEventId = "";
    else appointment.therapistGoogleEventId = "";
  }
  appointment.googleEventId = "";
  // ** Concurrency: bookkeeping only, keep updatedAt (see syncConfirmedAppointment).
  await appointment.save({ timestamps: false });
}

export async function backfillCalendar(userId, role = "patient") {
  if (!(await getSettings()).integrations.googleCalendarEnabled) return;
  const ownership =
    role === "therapist" ? { therapist: userId } : { patient: userId };
  const appointments = await Appointment.find({
    ...ownership,
    status: "confirmed",
    scheduledStart: { $gte: new Date() },
  });
  for (const appointment of appointments)
    await syncConfirmedAppointment(appointment._id, userId);
}

export async function connectCalendarAccount(userId, tokens) {
  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    },
  );
  const profile = profileResponse.ok ? await profileResponse.json() : null;
  const user = await User.findByIdAndUpdate(
    userId,
    {
      "googleCalendar.connected": true,
      "googleCalendar.email": profile?.email || "Connected Google account",
      "googleCalendar.refreshTokenEncrypted": encrypt(tokens.refresh_token),
      "googleCalendar.connectedAt": new Date(),
    },
    { new: true },
  );
  if (!user) throw new Error("Account not found.");
  return user;
}

export async function getCalendarStatus(userId) {
  const user = await User.findById(userId).select("googleCalendar");
  const calendar = user?.googleCalendar;
  return {
    connected: Boolean(calendar?.connected),
    email: calendar?.email || "",
    connectedAt: calendar?.connectedAt || null,
  };
}

export async function disconnectCalendarAccount(userId) {
  await User.updateOne(
    { _id: userId },
    {
      "googleCalendar.connected": false,
      "googleCalendar.email": "",
      "googleCalendar.refreshTokenEncrypted": "",
    },
  );
}

export { encrypt };
