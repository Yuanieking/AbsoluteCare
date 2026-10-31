import crypto from "node:crypto";
import Appointment from "../models/appointmentModel.js";
import User from "../models/userModel.js";
import { getSettings } from "./settingsService.js";
import {
  CLINIC_ADDRESS,
  GOOGLE_CALENDAR_ENCRYPTION_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_SECRET_KEY,
} from "../config/env.js";

const encryptionKey = crypto
  .createHash("sha256")
  .update(GOOGLE_CALENDAR_ENCRYPTION_KEY)
  .digest();

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(value) {
  const [ivHex, tagHex, dataHex] = value.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
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
    client_id: GOOGLE_CLIENT_ID,
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
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_SECRET_KEY,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Google Calendar authorization failed.");
  return response.json();
}

async function accessToken(user) {
  const refreshToken = decrypt(user.googleCalendar.refreshTokenEncrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_SECRET_KEY,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok)
    throw new Error("Google Calendar authorization has expired.");
  return (await response.json()).access_token;
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
          ...options.headers,
        },
      },
    );
    if (response.status === 401)
      throw new Error("Google Calendar authorization has expired.");
    if (!response.ok) throw new Error("Google Calendar request failed.");
    return response.status === 204 ? null : response.json();
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
  const user = await User.findById(calendarUserId || appointment.patient);
  if (!user?.googleCalendar?.connected) return null;
  const isTherapistCalendar = Boolean(calendarUserId);
  const eventId = isTherapistCalendar
    ? appointment.therapistGoogleEventId
    : appointment.googleEventId;
  const payload = eventPayload(appointment);
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
    if (isTherapistCalendar) appointment.therapistGoogleEventId = event.id;
    else {
      appointment.googleEventId = event.id;
      appointment.googleEventLink = event.htmlLink || "";
    }
    await appointment.save();
  }
  return event;
}

export async function deleteCalendarEvent(appointment) {
  if (!(await getSettings()).integrations.googleCalendarEnabled) return;
  const calendars = [
    [appointment.patient, appointment.googleEventId, "googleEventId"],
    [
      appointment.therapist,
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
    appointment[field] = "";
  }
  appointment.googleEventId = "";
  await appointment.save();
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

export { encrypt };
