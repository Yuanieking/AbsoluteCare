import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import Appointment from "../models/appointmentModel.js";
import { sendEmail } from "./mailer.js";
import { assertNotStale, freshFilter } from "./concurrencyService.js";
import { getSettings } from "./settingsService.js";
import { renderNotificationEmail } from "../emails/templates/index.js";

const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

function preferenceCategory(type) {
  if (type === "appointment_reminder") return "reminders";
  if (["system", "account_update", "payment_recorded"].includes(type))
    return "system";
  return "appointmentUpdates";
}

// Callers pass ids, populated documents or the user document; all resolve to
// the same stored ref, which Mongoose casts on write.
function refId(ref) {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return "_id" in ref ? ref._id : ref;
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
}) {
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
    });
    if (duplicate) return null;
  }

  const preferences = recipient.notificationPreferences || {};
  const category = preferences[preferenceCategory(type)] || {};
  let notification = null;
  if (inAppAllowed && preferences.inApp !== false && category.inApp !== false) {
    // Route-provided ids arrive as strings; Mongoose casts them on create.
    notification = await Notification.create({
      user: recipient._id,
      type,
      title,
      message,
      appointment: refId(appointment),
      dependent: refId(dependent),
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
      appointment: appointmentDetails || appointment,
      dependent: dependent,
      actionUrl: link,
    })
      .then(sendEmail)
      .catch((error) =>
        console.error("Notification email failed:", error.message),
      );
  }
  return notification;
}

export async function notifyMany(users, payload) {
  return Promise.all(
    users.filter(Boolean).map((user) => notify({ user, ...payload })),
  );
}

export const createPatientNotification = notify;

export async function notifyAppointmentConfirmed(appointment) {
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
  appointment,
  oldSchedule = "",
) {
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

export async function notifyAppointmentCancelled(appointment, reason = "") {
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

export async function notifyAppointmentCompleted(appointment) {
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

export async function notifyAppointmentNoShow(appointment) {
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

export async function listNotificationFeed(userId, options) {
  const query = {
    user: userId,
    createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  };
  if (options.unread) query.isRead = false;
  if (options.cursor) {
    query.createdAt.$lt = options.cursor;
  }
  return Notification.find(query)
    .populate(
      "appointment",
      "status scheduledStart requestedDate requestedTime",
    )
    .populate("dependent", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(options.limit + 1);
}

export async function unreadNotificationCount(userId) {
  return Notification.countDocuments({ user: userId, isRead: false });
}

export async function markNotificationRead(userId, id, ifMatch) {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const notification = await Notification.findOneAndUpdate(
    {
      user: userId,
      _id: id,
      ...freshFilter(ifMatch),
    },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  );
  if (!notification)
    await assertNotStale(ifMatch, () => ownNotification(userId, id));
  return notification;
}

export async function markNotificationUnread(userId, id, ifMatch) {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const notification = await Notification.findOneAndUpdate(
    {
      user: userId,
      _id: id,
      ...freshFilter(ifMatch),
    },
    { $set: { isRead: false, readAt: null } },
    { new: true },
  );
  if (!notification)
    await assertNotStale(ifMatch, () => ownNotification(userId, id));
  return notification;
}

export async function markAllNotificationsRead(userId) {
  await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
}

export async function deleteNotification(userId, id, ifMatch) {
  // ** Concurrency: delete only the version the client saw when If-Match is sent.
  const result = await Notification.deleteOne({
    user: userId,
    _id: id,
    ...freshFilter(ifMatch),
  });
  if (!result.deletedCount)
    await assertNotStale(ifMatch, () => ownNotification(userId, id));
  return Boolean(result.deletedCount);
}

function ownNotification(userId, id) {
  return Notification.exists({
    user: userId,
    _id: id,
  });
}

export async function clearReadNotifications(userId) {
  await Notification.deleteMany({ user: userId, isRead: true });
}
