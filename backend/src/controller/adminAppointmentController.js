import Appointment from "../models/appointmentModel.js";
import User from "../models/userModel.js";
import TherapyService from "../models/therapyServiceModel.js";
import {
  deleteCalendarEvent,
  syncConfirmedAppointment,
} from "../services/calendarService.js";
import {
  createPatientNotification,
  notifyAppointmentCancelled,
  notifyAppointmentConfirmed,
  notifyAppointmentRescheduled,
} from "../services/notificationService.js";
import { manilaDateTime } from "../utils/appointmentDates.js";

const userFields =
  "firstname lastname email phone profilePicture specialization workingDays workingHours googleCalendar.connected";
const populate = [
  { path: "patient", select: "firstname lastname email phone profilePicture" },
  { path: "dependent", select: "firstName lastName dateOfBirth relationship" },
  { path: "therapist", select: userFields },
  { path: "service", select: "name description duration fee" },
];

function scheduleFor(appointment, date, time) {
  const start = manilaDateTime(date, time);
  const end = new Date(
    start.getTime() +
      (appointment.serviceSnapshot?.duration ||
        appointment.service.duration ||
        60) *
        60 *
        1000,
  );
  return { start, end };
}

function statusError(res, appointment, action, statuses) {
  if (statuses.includes(appointment.status)) return false;
  res.status(409).json({
    message: `Cannot ${action} an appointment with status "${appointment.status}".`,
  });
  return true;
}

function audit(
  appointment,
  req,
  action,
  details = "",
  toStatus = appointment.status,
) {
  appointment.auditLog.push({
    action,
    by: req.user.userId,
    fromStatus: appointment.status,
    toStatus,
    details,
  });
}

function dayName(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

function therapistMatches(therapist, service, start, end) {
  const specializations = Array.isArray(therapist.specialization)
    ? therapist.specialization
    : [therapist.specialization].filter(Boolean);
  const serviceName = service.name.toLowerCase();
  const qualified =
    !specializations.length ||
    specializations.some(
      (item) =>
        serviceName.includes(String(item).toLowerCase()) ||
        String(item).toLowerCase().includes(serviceName),
    );
  const dayAvailable =
    !therapist.workingDays?.length ||
    therapist.workingDays.includes(dayName(start));
  const hours = therapist.workingHours || {};
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Manila",
  }).format(start);
  const endTime = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Manila",
  }).format(end);
  return (
    qualified &&
    dayAvailable &&
    (!hours.start || (time >= hours.start && endTime <= hours.end))
  );
}

async function hasConflict(therapistId, start, end, appointmentId = null) {
  return Appointment.exists({
    therapist: therapistId,
    status: "confirmed",
    ...(appointmentId ? { _id: { $ne: appointmentId } } : {}),
    scheduledStart: { $lt: end },
    scheduledEnd: { $gt: start },
  });
}

async function assertTherapistAvailable(appointment, therapistId, start, end) {
  const therapist = await User.findOne({
    _id: therapistId,
    role: "therapist",
    isActive: true,
  }).select(userFields);
  if (!therapist) return "Choose an active therapist.";
  if (!therapistMatches(therapist, appointment.service, start, end))
    return "This therapist is not qualified or available for that date and time.";
  if (await hasConflict(therapist._id, start, end, appointment._id))
    return "That therapist already has a confirmed appointment at this time.";
  return null;
}

async function notifyTherapist(appointment, type, title, message) {
  if (!appointment.therapist) return;
  await createPatientNotification({
    user: appointment.therapist,
    type,
    title,
    message,
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/staff/therapist/appointments/${appointment._id}`,
  });
}

async function syncCalendars(appointment) {
  await Promise.allSettled([
    syncConfirmedAppointment(appointment._id),
    appointment.therapist
      ? syncConfirmedAppointment(
          appointment._id,
          appointment.therapist._id || appointment.therapist,
        )
      : Promise.resolve(),
  ]);
}

async function loadAppointment(id) {
  return Appointment.findById(id).populate(populate);
}

export async function listAppointments(req, res) {
  const tab = req.query.tab || "pending";
  const status = req.query.status;
  const now = new Date();
  const query =
    status && status !== "all"
      ? status === "rescheduled"
        ? { status: "confirmed", "rescheduleRequest.status": "requested" }
        : { status }
      : tab === "pending"
        ? { status: "pending" }
        : tab === "upcoming"
          ? { status: "confirmed", scheduledStart: { $gte: now } }
          : {
              $or: [
                { status: { $in: ["completed", "cancelled", "no_show"] } },
                { status: "confirmed", scheduledStart: { $lt: now } },
              ],
            };
  if (req.query.from || req.query.to) {
    query.scheduledStart = {
      ...(req.query.from ? { $gte: new Date(req.query.from) } : {}),
      ...(req.query.to ? { $lte: new Date(req.query.to) } : {}),
    };
  }
  const appointments = await Appointment.find(query)
    .populate(populate)
    .sort(
      tab === "previous"
        ? { scheduledStart: -1, requestedDate: -1 }
        : { scheduledStart: 1, requestedDate: 1 },
    );
  const search = req.query.search?.trim().toLowerCase();
  const filtered = search
    ? appointments.filter((item) =>
        `${item.patient?.firstname} ${item.patient?.lastname} ${item.patient?.email || ""} ${item.patient?.phone || ""} ${item.therapist?.firstname || ""} ${item.therapist?.lastname || ""} ${item.service?.name || ""}`
          .toLowerCase()
          .includes(search),
      )
    : appointments;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  res.json({
    appointments: filtered.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total: filtered.length,
      pages: Math.ceil(filtered.length / limit),
    },
  });
}

export async function getAppointment(req, res) {
  const appointment = await loadAppointment(req.params.id);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  res.json({ appointment });
}

export async function listAvailableTherapists(req, res) {
  const appointment = await loadAppointment(req.params.id);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (statusError(res, appointment, "assign a therapist to", ["pending"]))
    return;
  const schedule = scheduleFor(
    appointment,
    appointment.requestedDate,
    appointment.requestedTime,
  );
  const therapists = await User.find({ role: "therapist", isActive: true })
    .select(userFields)
    .sort({ lastname: 1, firstname: 1 });
  const available = [];
  for (const therapist of therapists) {
    if (
      !therapistMatches(
        therapist,
        appointment.service,
        schedule.start,
        schedule.end,
      )
    )
      continue;
    if (
      await hasConflict(
        therapist._id,
        schedule.start,
        schedule.end,
        appointment._id,
      )
    )
      continue;
    available.push(therapist);
  }
  res.json({ therapists: available });
}

export async function assignTherapist(req, res) {
  const appointment = await loadAppointment(req.params.id);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (statusError(res, appointment, "assign a therapist to", ["pending"]))
    return;
  const therapistId = req.body.therapistId;
  const schedule = scheduleFor(
    appointment,
    appointment.requestedDate,
    appointment.requestedTime,
  );
  const error = await assertTherapistAvailable(
    appointment,
    therapistId,
    schedule.start,
    schedule.end,
  );
  if (error) return res.status(409).json({ message: error });
  appointment.therapist = therapistId;
  audit(appointment, req, "therapist_assigned", req.body.note?.trim() || "");
  await appointment.save();
  await appointment.populate(populate);
  await notifyTherapist(
    appointment,
    "appointment_assigned",
    "Appointment assigned",
    "A new appointment has been assigned to your schedule.",
  );
  res.json({ appointment, message: "Therapist assigned." });
}

export async function confirmAppointment(req, res) {
  const appointment = await loadAppointment(req.params.id);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (statusError(res, appointment, "confirm", ["pending"])) return;
  if (!appointment.therapist)
    return res.status(400).json({
      message: "Assign a therapist before confirming this appointment.",
    });
  const schedule = scheduleFor(
    appointment,
    appointment.requestedDate,
    appointment.requestedTime,
  );
  const error = await assertTherapistAvailable(
    appointment,
    appointment.therapist._id,
    schedule.start,
    schedule.end,
  );
  if (error) return res.status(409).json({ message: error });
  appointment.scheduledStart = schedule.start;
  appointment.scheduledEnd = schedule.end;
  appointment.status = "confirmed";
  audit(appointment, req, "confirmed", "", "confirmed");
  await appointment.save();
  await notifyAppointmentConfirmed(appointment);
  await notifyTherapist(
    appointment,
    "appointment_confirmed",
    "Appointment confirmed",
    "An appointment has been confirmed on your schedule.",
  );
  await syncCalendars(appointment);
  await appointment.populate(populate);
  res.json({ appointment, message: "Appointment confirmed." });
}

async function reschedule(appointment, req, date, time, reason = "") {
  const schedule = scheduleFor(appointment, date, time);
  if (Number.isNaN(schedule.start.getTime()) || schedule.start <= new Date())
    return { message: "Choose a future date and time." };
  if (appointment.therapist) {
    const error = await assertTherapistAvailable(
      appointment,
      appointment.therapist._id,
      schedule.start,
      schedule.end,
    );
    if (error) return { message: error };
  }
  const oldSchedule =
    appointment.scheduledStart?.toISOString() ||
    `${appointment.requestedDate} ${appointment.requestedTime}`;
  appointment.requestedDate = date;
  appointment.requestedTime = time;
  appointment.scheduledStart = schedule.start;
  appointment.scheduledEnd = schedule.end;
  appointment.rescheduleRequest = { status: "none" };
  audit(appointment, req, "rescheduled", reason, appointment.status);
  await appointment.save();
  await notifyAppointmentRescheduled(appointment, oldSchedule);
  await notifyTherapist(
    appointment,
    "appointment_rescheduled",
    "Appointment rescheduled",
    "An appointment on your schedule has moved.",
  );
  await syncCalendars(appointment);
  return null;
}

export async function rescheduleAppointment(req, res) {
  const appointment = await loadAppointment(req.params.id);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (statusError(res, appointment, "reschedule", ["confirmed"])) return;
  const error = await reschedule(
    appointment,
    req,
    req.body.newDate,
    req.body.newTime,
    req.body.reason,
  );
  if (error) return res.status(409).json(error);
  await appointment.populate(populate);
  res.json({ appointment, message: "Appointment rescheduled." });
}

export async function approveReschedule(req, res) {
  const appointment = await loadAppointment(req.params.id);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (statusError(res, appointment, "approve a reschedule for", ["confirmed"]))
    return;
  if (appointment.rescheduleRequest?.status !== "requested")
    return res
      .status(409)
      .json({ message: "There is no open reschedule request." });
  const request = appointment.rescheduleRequest;
  const error = await reschedule(
    appointment,
    req,
    request.proposedDate,
    request.proposedTime,
    request.reason,
  );
  if (error) return res.status(409).json(error);
  res.json({ appointment, message: "Reschedule request approved." });
}

export async function declineReschedule(req, res) {
  const appointment = await loadAppointment(req.params.id);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (statusError(res, appointment, "decline a reschedule for", ["confirmed"]))
    return;
  if (appointment.rescheduleRequest?.status !== "requested")
    return res
      .status(409)
      .json({ message: "There is no open reschedule request." });
  const requester =
    appointment.rescheduleRequest.requestedBy === "therapist"
      ? appointment.therapist
      : appointment.patient;
  const requesterWasTherapist =
    appointment.rescheduleRequest.requestedBy === "therapist";
  const reason =
    req.body.reason?.trim() || "The proposed time is not available.";
  appointment.rescheduleRequest = { status: "none" };
  audit(appointment, req, "reschedule_declined", reason);
  await appointment.save();
  await createPatientNotification({
    user: requester._id || requester,
    type: "reschedule_declined",
    title: "Reschedule request declined",
    message: reason,
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: requesterWasTherapist
      ? `/staff/therapist/appointments/${appointment._id}`
      : `/dashboard/appointments/${appointment._id}`,
  });
  res.json({ appointment, message: "Reschedule request declined." });
}

export async function cancelAppointment(req, res) {
  const appointment = await loadAppointment(req.params.id);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (statusError(res, appointment, "cancel", ["pending", "confirmed"])) return;
  const reason = req.body.reason?.trim();
  if (!reason)
    return res.status(400).json({ message: "Choose a cancellation reason." });
  appointment.status = "cancelled";
  appointment.cancelReason = reason;
  appointment.cancelledBy = req.user.userId;
  audit(appointment, req, "cancelled", reason, "cancelled");
  await appointment.save();
  await notifyAppointmentCancelled(
    appointment,
    `Your appointment was cancelled: ${reason}`,
  );
  await notifyTherapist(
    appointment,
    "appointment_cancelled",
    "Appointment cancelled",
    `An appointment was cancelled: ${reason}`,
  );
  await deleteCalendarEvent(appointment);
  res.json({ appointment, message: "Appointment cancelled." });
}
