import {
  applyReschedule,
  assignTherapist as saveTherapistAssignment,
  cancelAppointmentRecord,
  confirmAppointmentRecord,
  declineRescheduleRequest,
  findActiveTherapistById,
  findActiveTherapists,
  findAppointments,
  getAppointmentById,
  hasConfirmedConflict,
  repopulate,
} from "../services/adminAppointmentService.js";
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
import { availabilityError } from "../services/availabilityService.js";
import { adminNotificationSchema } from "../schemas/appointmentSchema.js";
import { manilaDateTime } from "../utils/appointmentDates.js";
import { guardFresh } from "../services/concurrencyService.js";

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

/** First failure wins, and each failure names the rule that blocked it. */
function therapistMismatch(therapist, service, start, end) {
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
  if (!qualified) {
    return `This therapist's specialization does not cover ${service.name}.`;
  }
  return availabilityError(therapist, start, end);
}

async function assertTherapistAvailable(appointment, therapistId, start, end) {
  const therapist = await findActiveTherapistById(therapistId);
  if (!therapist) return "Choose an active therapist.";
  const mismatch = therapistMismatch(
    therapist,
    appointment.service,
    start,
    end,
  );
  if (mismatch) return mismatch;
  if (await hasConfirmedConflict(therapist._id, start, end, appointment._id))
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
    syncConfirmedAppointment(String(appointment._id)),
    appointment.therapist
      ? syncConfirmedAppointment(
          String(appointment._id),
          String(appointment.therapist._id),
        )
      : Promise.resolve(),
  ]);
}

export async function listAppointments(req, res) {
  const tab = String(req.query.tab || "pending");
  const statusValue = req.query.status;
  const status = typeof statusValue === "string" ? statusValue : undefined;
  const now = new Date();
  let query;
  if (status && status !== "all") {
    query =
      status === "rescheduled"
        ? { status: "confirmed", "rescheduleRequest.status": "requested" }
        : { status };
  } else if (tab === "pending") {
    query = { status: "pending" };
  } else if (tab === "upcoming") {
    query = { status: "confirmed", scheduledStart: { $gte: now } };
  } else {
    query = {
      $or: [
        { status: { $in: ["completed", "cancelled", "no_show"] } },
        { status: "confirmed", scheduledStart: { $lt: now } },
      ],
    };
  }
  if (req.query.from || req.query.to) {
    query.scheduledStart = {
      ...(req.query.from ? { $gte: new Date(String(req.query.from)) } : {}),
      ...(req.query.to ? { $lte: new Date(String(req.query.to)) } : {}),
    };
  }
  if (typeof req.query.therapist === "string" && req.query.therapist)
    query.therapist = req.query.therapist;
  if (typeof req.query.service === "string" && req.query.service)
    query.service = req.query.service;
  const sort =
    tab === "previous"
      ? { scheduledStart: -1, requestedDate: -1 }
      : { scheduledStart: 1, requestedDate: 1 };
  const appointments = await findAppointments(query, sort);
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().toLowerCase()
      : undefined;
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
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  res.json({ appointment });
}

export async function listAvailableTherapists(req, res) {
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  if (statusError(res, appointment, "assign a therapist to", ["pending"]))
    return;
  const schedule = scheduleFor(
    appointment,
    appointment.requestedDate,
    appointment.requestedTime,
  );
  const therapists = await findActiveTherapists();
  const available = [];
  for (const therapist of therapists) {
    if (
      therapistMismatch(
        therapist,
        appointment.service,
        schedule.start,
        schedule.end,
      )
    )
      continue;
    if (
      await hasConfirmedConflict(
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
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
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
  if (error) {
    res.status(409).json({ message: error });
    return;
  }
  const note = req.body.note?.trim() || "";
  await saveTherapistAssignment(
    appointment,
    therapistId,
    req.user.userId,
    note,
  );
  await repopulate(appointment);
  await notifyTherapist(
    appointment,
    "appointment_assigned",
    "Appointment assigned",
    "A new appointment has been assigned to your schedule.",
  );
  res.json({ appointment, message: "Therapist assigned." });
}

export async function confirmAppointment(req, res) {
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
  if (statusError(res, appointment, "confirm", ["pending"])) return;
  if (!appointment.therapist) {
    res.status(400).json({
      message: "Assign a therapist before confirming this appointment.",
    });
    return;
  }
  const schedule = scheduleFor(
    appointment,
    appointment.requestedDate,
    appointment.requestedTime,
  );
  const error = await assertTherapistAvailable(
    appointment,
    String(appointment.therapist._id),
    schedule.start,
    schedule.end,
  );
  if (error) {
    res.status(409).json({ message: error });
    return;
  }
  await confirmAppointmentRecord(appointment, schedule, req.user.userId);
  await notifyAppointmentConfirmed(appointment);
  await notifyTherapist(
    appointment,
    "appointment_confirmed",
    "Appointment confirmed",
    "An appointment has been confirmed on your schedule.",
  );
  await syncCalendars(appointment);
  await repopulate(appointment);
  res.json({ appointment, message: "Appointment confirmed." });
}

async function reschedule(appointment, req, date, time, reason = "") {
  const schedule = scheduleFor(appointment, date, time);
  if (Number.isNaN(schedule.start.getTime()) || schedule.start <= new Date())
    return { message: "Choose a future date and time." };
  if (appointment.therapist) {
    const error = await assertTherapistAvailable(
      appointment,
      String(appointment.therapist._id),
      schedule.start,
      schedule.end,
    );
    if (error) return { message: error };
  }
  const oldSchedule =
    appointment.scheduledStart?.toISOString() ||
    `${appointment.requestedDate} ${appointment.requestedTime}`;
  await applyReschedule(
    appointment,
    schedule,
    date,
    time,
    reason,
    req.user.userId,
  );
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
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
  if (statusError(res, appointment, "reschedule", ["confirmed"])) return;
  const newDate = req.body.newDate;
  const newTime = req.body.newTime;
  const reason = req.body.reason;
  const error = await reschedule(appointment, req, newDate, newTime, reason);
  if (error) {
    res.status(409).json(error);
    return;
  }
  await repopulate(appointment);
  res.json({ appointment, message: "Appointment rescheduled." });
}

export async function approveReschedule(req, res) {
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
  if (statusError(res, appointment, "approve a reschedule for", ["confirmed"]))
    return;
  if (appointment.rescheduleRequest?.status !== "requested") {
    res.status(409).json({ message: "There is no open reschedule request." });
    return;
  }
  const request = appointment.rescheduleRequest;
  const error = await reschedule(
    appointment,
    req,
    request.proposedDate,
    request.proposedTime,
    request.reason,
  );
  if (error) {
    res.status(409).json(error);
    return;
  }
  res.json({ appointment, message: "Reschedule request approved." });
}

export async function declineReschedule(req, res) {
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
  if (statusError(res, appointment, "decline a reschedule for", ["confirmed"]))
    return;
  if (appointment.rescheduleRequest?.status !== "requested") {
    res.status(409).json({ message: "There is no open reschedule request." });
    return;
  }
  const requesterWasTherapist =
    appointment.rescheduleRequest.requestedBy === "therapist";
  const requester = requesterWasTherapist
    ? appointment.therapist
    : appointment.patient;
  const reason =
    req.body.reason?.trim() || "The proposed time is not available.";
  await declineRescheduleRequest(appointment, req.user.userId, reason);
  await createPatientNotification({
    user: requester._id,
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
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
  if (statusError(res, appointment, "cancel", ["pending", "confirmed"])) return;
  const reason = req.body.reason?.trim();
  if (!reason) {
    res.status(400).json({ message: "Choose a cancellation reason." });
    return;
  }
  await cancelAppointmentRecord(appointment, req.user.userId, reason);
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

export async function sendAppointmentNotification(req, res) {
  const appointment = await getAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  const { message } = adminNotificationSchema.parse(req.body);
  const notice = {
    type: "appointment_notice",
    title: "Appointment update",
    message,
    appointment: appointment._id,
    dependent: appointment.dependent,
    skipDedupe: true,
  };
  await createPatientNotification({
    ...notice,
    user: appointment.patient,
    link: `/dashboard/appointments/${appointment._id}`,
  });
  if (appointment.therapist) {
    await createPatientNotification({
      ...notice,
      user: appointment.therapist,
      link: `/staff/therapist/appointments/${appointment._id}`,
    });
  }
  res.json({
    message: appointment.therapist
      ? "Notification sent to the patient and therapist."
      : "Notification sent to the patient.",
  });
}
