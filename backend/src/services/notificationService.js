import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import Appointment from "../models/appointmentModel.js";
import { sendEmail } from "./mailer.js";
import { renderNotificationEmail } from "../emails/templates/index.js";

const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

function preferenceCategory(type) {
  if (type === "appointment_reminder") return "reminders";
  if (["system", "account_update", "payment_recorded"].includes(type))
    return "system";
  return "appointmentUpdates";
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
}) {
  const recipientId = user?._id || user;
  const recipient = await User.findById(recipientId).select(
    "email notificationPreferences",
  );
  if (!recipient || String(recipient._id) === String(actorId || ""))
    return null;

  const duplicateSince = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const duplicate = await Notification.exists({
    user: recipientId,
    type,
    ...(appointment ? { appointment } : {}),
    createdAt: { $gte: duplicateSince },
  });
  if (duplicate) return null;

  const preferences = recipient.notificationPreferences || {};
  const category = preferences[preferenceCategory(type)] || {};
  let notification = null;
  if (preferences.inApp !== false && category.inApp !== false) {
    notification = await Notification.create({
      user: recipient._id,
      type,
      title,
      message,
      appointment,
      dependent,
      link,
    });
  }
  if (
    recipient.email &&
    preferences.email !== false &&
    category.email !== false
  ) {
    const appointmentDetails = appointment
      ? await Appointment.findById(appointment)
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
      appointment: appointmentDetails || appointment,
      dependent,
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
