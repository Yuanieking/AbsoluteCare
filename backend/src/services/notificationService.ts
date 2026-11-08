import type { QueryFilter, Types } from "mongoose";
import Notification, {
  type Notification as NotificationData,
  type NotificationType,
} from "../models/notificationModel.js";
import User, { type UserDoc } from "../models/userModel.js";
import Appointment from "../models/appointmentModel.js";
import { sendEmail } from "./mailer.js";
import { assertNotStale, freshFilter } from "./concurrencyService.js";
import { getSettings } from "./settingsService.js";
import {
  renderNotificationEmail,
  type EmailAppointment as EmailAppointmentLike,
  type EmailPerson,
} from "../emails/templates/index.js";

const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

export type NotificationRef =
  | Types.ObjectId
  | string
  | { _id: Types.ObjectId }
  | null
  | undefined;

export interface NotifyOptions {
  user: NotificationRef | UserDoc;
  type: NotificationType;
  title: string;
  message: string;
  appointment?: NotificationRef;
  dependent?: NotificationRef;
  link?: string;
  actorId?: NotificationRef;
  // A person asked for this one explicitly, so the short duplicate guard does
  // not apply.
  skipDedupe?: boolean;
}

type PreferenceCategory = "appointmentUpdates" | "reminders" | "system";

interface ChannelPreference {
  inApp?: boolean;
  email?: boolean;
}

interface NotificationPreferences {
  inApp?: boolean;
  email?: boolean;
  appointmentUpdates?: ChannelPreference;
  reminders?: ChannelPreference;
  system?: ChannelPreference;
}

function preferenceCategory(type: string): PreferenceCategory {
  if (type === "appointment_reminder") return "reminders";
  if (["system", "account_update", "payment_recorded"].includes(type))
    return "system";
  return "appointmentUpdates";
}

// Callers pass ids, populated documents or the user document; all resolve to
// the same stored ref, which Mongoose casts on write.
function refId(ref: NotificationRef): Types.ObjectId | string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return "_id" in ref ? (ref as { _id: Types.ObjectId })._id : ref;
}

export async function notify({
  user,
  type,
  title,
  message,
  appointment = null,
  dependent = null,
  link = "",
  actorId = null,
  skipDedupe = false,
}: NotifyOptions): Promise<NotificationData | null> {
  const recipientId = refId(user);
  const recipient = await User.findById(recipientId).select(
    "email notificationPreferences",
  );
  if (!recipient || String(recipient._id) === String(refId(actorId) || ""))
    return null;

  // The admin settings switch each channel off clinic-wide; user preferences
  // only narrow that further.
  const clinic = (await getSettings()).notifications;
  const inAppAllowed = clinic?.inAppEnabled !== false;
  const emailAllowed = clinic?.emailEnabled !== false;
  if (!inAppAllowed && !emailAllowed) return null;

  if (!skipDedupe) {
    const duplicateSince = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const duplicate = await Notification.exists({
      user: recipientId,
      type,
      ...(appointment ? { appointment } : {}),
      createdAt: { $gte: duplicateSince },
    } as QueryFilter<NotificationData>);
    if (duplicate) return null;
  }

  const preferences = (recipient.notificationPreferences ||
    {}) as NotificationPreferences;
  const category = preferences[preferenceCategory(type)] || {};
  let notification: NotificationData | null = null;
  if (inAppAllowed && preferences.inApp !== false && category.inApp !== false) {
    // Route-provided ids arrive as strings; Mongoose casts them on create.
    notification = await Notification.create({
      user: recipient._id,
      type,
      title,
      message,
      appointment: refId(appointment) as Types.ObjectId | null,
      dependent: refId(dependent) as Types.ObjectId | null,
      link,
    });
  }
  if (
    emailAllowed &&
    recipient.email &&
    preferences.email !== false &&
    category.email !== false
  ) {
    const appointmentDetails = appointment
      ? await Appointment.findById(refId(appointment))
          .populate("patient", "firstname lastname email")
          .populate("dependent", "firstName lastName")
          .populate("therapist", "firstname lastname")
          .lean()
      : null;
    void renderNotificationEmail({
      type,
      recipientEmail: recipient.email,
      title,
      message,
      // The template tolerates a populated document, a raw id or null.
      appointment: (appointmentDetails ||
        appointment) as unknown as EmailAppointmentLike | null,
      dependent: dependent as unknown as EmailPerson | null,
      actionUrl: link,
    })
      .then(sendEmail)
      .catch((error: unknown) =>
        console.error("Notification email failed:", (error as Error).message),
      );
  }
  return notification;
}

export async function notifyMany(
  users: Array<NotifyOptions["user"]>,
  payload: Omit<NotifyOptions, "user">,
): Promise<Array<NotificationData | null>> {
  return Promise.all(
    users.filter(Boolean).map((user) => notify({ user, ...payload })),
  );
}

export const createPatientNotification = notify;

export type NotificationKind = NotificationType;

export interface AppointmentNotificationSource {
  _id: Types.ObjectId;
  patient: NotificationRef | UserDoc;
  dependent: NotificationRef | UserDoc;
}

export async function notifyAppointmentConfirmed(
  appointment: AppointmentNotificationSource,
): Promise<NotificationData | null> {
  return notify({
    user: appointment.patient,
    type: "appointment_confirmed",
    title: "Appointment confirmed",
    message:
      "Your appointment has been confirmed and a therapist has been assigned.",
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
  });
}

export async function notifyAppointmentRescheduled(
  appointment: AppointmentNotificationSource,
  oldSchedule = "",
): Promise<NotificationData | null> {
  return notify({
    user: appointment.patient,
    type: "appointment_rescheduled",
    title: "Appointment rescheduled",
    message: oldSchedule
      ? `Your appointment moved from ${oldSchedule}. Check the new schedule for details.`
      : "Your appointment schedule has changed. Check the new details.",
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
  });
}

export async function notifyAppointmentCancelled(
  appointment: AppointmentNotificationSource,
  reason = "",
): Promise<NotificationData | null> {
  return notify({
    user: appointment.patient,
    type: "appointment_cancelled",
    title: "Appointment cancelled",
    message:
      reason ||
      "Your appointment was cancelled. Please book another visit when ready.",
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
  });
}

export async function notifyAppointmentCompleted(
  appointment: AppointmentNotificationSource,
): Promise<NotificationData | null> {
  return notify({
    user: appointment.patient,
    type: "appointment_completed",
    title: "Appointment completed",
    message: "Your appointment was marked as completed.",
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
  });
}

export async function notifyAppointmentNoShow(
  appointment: AppointmentNotificationSource,
): Promise<NotificationData | null> {
  return notify({
    user: appointment.patient,
    type: "appointment_no_show",
    title: "Appointment marked no-show",
    message:
      "Your appointment was marked as a no-show. Contact the clinic if this is incorrect.",
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
  });
}

export async function listNotificationFeed(
  userId: string,
  options: { limit: number; unread: boolean; cursor?: Date },
): Promise<NotificationData[]> {
  const query: Record<string, unknown> = {
    user: userId,
    createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  };
  if (options.unread) query.isRead = false;
  if (options.cursor) {
    (query.createdAt as Record<string, unknown>).$lt = options.cursor;
  }
  return Notification.find(query as QueryFilter<NotificationData>)
    .populate(
      "appointment",
      "status scheduledStart requestedDate requestedTime",
    )
    .populate("dependent", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(options.limit + 1);
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return Notification.countDocuments({ user: userId, isRead: false });
}

export async function markNotificationRead(
  userId: string,
  id: string,
  ifMatch?: string,
): Promise<NotificationData | null> {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const notification = await Notification.findOneAndUpdate(
    {
      user: userId,
      _id: id,
      ...freshFilter(ifMatch),
    } as QueryFilter<NotificationData>,
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  );
  if (!notification)
    await assertNotStale(ifMatch, () => ownNotification(userId, id));
  return notification;
}

export async function markNotificationUnread(
  userId: string,
  id: string,
  ifMatch?: string,
): Promise<NotificationData | null> {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const notification = await Notification.findOneAndUpdate(
    {
      user: userId,
      _id: id,
      ...freshFilter(ifMatch),
    } as QueryFilter<NotificationData>,
    { $set: { isRead: false, readAt: null } },
    { new: true },
  );
  if (!notification)
    await assertNotStale(ifMatch, () => ownNotification(userId, id));
  return notification;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
}

export async function deleteNotification(
  userId: string,
  id: string,
  ifMatch?: string,
): Promise<boolean> {
  // ** Concurrency: delete only the version the client saw when If-Match is sent.
  const result = await Notification.deleteOne({
    user: userId,
    _id: id,
    ...freshFilter(ifMatch),
  } as QueryFilter<NotificationData>);
  if (!result.deletedCount)
    await assertNotStale(ifMatch, () => ownNotification(userId, id));
  return Boolean(result.deletedCount);
}

function ownNotification(userId: string, id: string): Promise<unknown> {
  return Notification.exists({
    user: userId,
    _id: id,
  } as QueryFilter<NotificationData>);
}

export async function clearReadNotifications(userId: string): Promise<void> {
  await Notification.deleteMany({ user: userId, isRead: true });
}
