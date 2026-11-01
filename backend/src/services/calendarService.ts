import crypto from "node:crypto";
import type { Types } from "mongoose";
import Appointment, {
  type AppointmentDoc,
} from "../models/appointmentModel.js";
import User, { type UserDoc } from "../models/userModel.js";
import { getSettings } from "./settingsService.js";
import { CLINIC_ADDRESS } from "../config/env.js";
import { getIntegrationConfig } from "../config/runtimeConfig.js";

// ponytail: one cached key derivation, keyed by the material itself, so a
// rotated GOOGLE_CALENDAR_ENCRYPTION_KEY is picked up without a restart and
// old tokens fail to decrypt instead of silently decrypting with the new key.
let cipherKey: { material: string; key: Buffer | null } = {
  material: "",
  key: null,
};

function encryptionKey(): Buffer {
  const material = getIntegrationConfig("GOOGLE_CALENDAR_ENCRYPTION_KEY");
  if (cipherKey.material !== material) {
    cipherKey = {
      material,
      key: crypto.createHash("sha256").update(material).digest(),
    };
  }
  return cipherKey.key as Buffer;
}

function googleClient(): { id: string; secret: string } {
  return {
    id: getIntegrationConfig("GOOGLE_CLIENT_ID"),
    secret: getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
  };
}

function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(value: string | null | undefined): string {
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

export interface CalendarTokens {
  access_token?: string;
  refresh_token?: string;
}

interface GoogleProfile {
  email?: string;
}

interface CalendarEvent {
  id?: string;
  htmlLink?: string;
}

interface PopulatedAppointment extends Omit<
  AppointmentDoc,
  "service" | "therapist"
> {
  service: { name?: string } | null;
  therapist: { firstname: string; lastname: string } | null;
}

export function calendarAuthorizationUrl(state: {
  value: string;
  redirectUri: string;
}): string {
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

export async function exchangeCalendarCode(
  code: string,
  redirectUri: string,
): Promise<CalendarTokens> {
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
  return (await response.json()) as CalendarTokens;
}

async function accessToken(user: UserDoc): Promise<string> {
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
  const body = (await response.json()) as CalendarTokens;
  // Google always returns access_token on a successful refresh; the cast keeps
  // today's "Bearer undefined" behaviour if it ever does not.
  return body.access_token as string;
}

async function calendarRequest(
  user: UserDoc,
  path: string,
  options: { body?: string; method?: string } = {},
): Promise<CalendarEvent | null> {
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
    return (await response.json()) as CalendarEvent;
  } catch (error) {
    await User.updateOne(
      { _id: user._id },
      { "googleCalendar.connected": false },
    );
    throw error;
  }
}

function eventPayload(appointment: PopulatedAppointment): {
  summary: string;
  location: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
} {
  return {
    summary: `${appointment.service?.name || "Therapy session"} · AbsoluteCare`,
    location: CLINIC_ADDRESS,
    description: `Therapist: ${appointment.therapist ? `${appointment.therapist.firstname} ${appointment.therapist.lastname}` : "To be assigned"}`,
    start: {
      // Guarded by the caller's null check on scheduledStart/scheduledEnd.
      dateTime: appointment.scheduledStart!.toISOString(),
      timeZone: "Asia/Manila",
    },
    end: {
      dateTime: appointment.scheduledEnd!.toISOString(),
      timeZone: "Asia/Manila",
    },
  };
}

export async function syncConfirmedAppointment(
  appointmentId: unknown,
  calendarUserId: Types.ObjectId | string | null = null,
): Promise<CalendarEvent | null> {
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
  const populated = appointment as unknown as PopulatedAppointment;
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
    await populated.save();
  }
  return event;
}

// Accepts both a plain Appointment doc and a populated one (patient/therapist
// are documents at runtime); only their ids and event ids are used.
export interface CalendarEventOwner {
  patient: Types.ObjectId | { _id: Types.ObjectId } | null;
  therapist: Types.ObjectId | { _id: Types.ObjectId } | null;
  googleEventId: string;
  therapistGoogleEventId: string;
  save(): Promise<unknown>;
}

function ownerId(value: CalendarEventOwner["patient"]): Types.ObjectId | null {
  if (!value) return null;
  return typeof value === "object" && "_id" in value ? value._id : value;
}

export async function deleteCalendarEvent(
  appointment: CalendarEventOwner,
): Promise<void> {
  if (!(await getSettings()).integrations.googleCalendarEnabled) return;
  const calendars: Array<
    [Types.ObjectId | null, string, "googleEventId" | "therapistGoogleEventId"]
  > = [
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
  await appointment.save();
}

export async function backfillCalendar(
  userId: Types.ObjectId | string,
  role = "patient",
): Promise<void> {
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

export async function connectCalendarAccount(
  userId: string,
  tokens: CalendarTokens,
): Promise<UserDoc> {
  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    },
  );
  const profile = profileResponse.ok
    ? ((await profileResponse.json()) as GoogleProfile)
    : null;
  const user = await User.findByIdAndUpdate(
    userId,
    {
      "googleCalendar.connected": true,
      "googleCalendar.email": profile?.email || "Connected Google account",
      "googleCalendar.refreshTokenEncrypted": encrypt(
        tokens.refresh_token as string,
      ),
      "googleCalendar.connectedAt": new Date(),
    },
    { new: true },
  );
  if (!user) throw new Error("Account not found.");
  return user;
}

export async function getCalendarStatus(
  userId: Types.ObjectId | string,
): Promise<{
  connected: boolean;
  email: string;
  connectedAt: Date | null;
}> {
  const user = await User.findById(userId).select("googleCalendar");
  const calendar = user?.googleCalendar;
  return {
    connected: Boolean(calendar?.connected),
    email: calendar?.email || "",
    connectedAt: calendar?.connectedAt || null,
  };
}

export async function disconnectCalendarAccount(
  userId: Types.ObjectId | string,
): Promise<void> {
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
