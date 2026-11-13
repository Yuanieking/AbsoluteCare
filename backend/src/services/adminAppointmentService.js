import { Types } from "mongoose";
import Appointment from "../models/appointmentModel.js";
import User from "../models/userModel.js";

const userFields =
  "firstname lastname email phone profilePicture specialization workingDays workingHours workingHoursByDay googleCalendar.connected";

const populatePaths = [
  { path: "patient", select: "firstname lastname email phone profilePicture" },
  { path: "dependent", select: "firstName lastName dateOfBirth relationship" },
  { path: "therapist", select: userFields },
  { path: "service", select: "name description duration fee" },
];

function raw(appointment) {
  // populate() swaps ObjectId refs for documents at runtime; Mongoose keeps typing them as ObjectIds
  return appointment;
}

function pushAudit(
  appointment,
  actorId,
  action,
  details = "",
  toStatus = appointment.status,
) {
  appointment.auditLog.push({
    action,
    by: new Types.ObjectId(actorId),
    fromStatus: appointment.status,
    toStatus,
    details,
  });
}

export async function findAppointments(filter, sort) {
  const appointments = await Appointment.find(filter)
    .populate(populatePaths)
    .sort(sort);
  return appointments;
}

export async function getAppointmentById(id) {
  const appointment = await Appointment.findById(id).populate(populatePaths);
  return appointment;
}

export async function repopulate(appointment) {
  await appointment.populate(populatePaths);
}

export async function findActiveTherapists() {
  const therapists = await User.find({ role: "therapist", isActive: true })
    .select(userFields)
    .sort({ lastname: 1, firstname: 1 });
  // mongoose 9 drops instance-method typing on .select(); the docs have them.
  return therapists;
}

export async function findActiveTherapistById(therapistId) {
  const filter = {
    _id: therapistId,
    role: "therapist",
    isActive: true,
  };
  // filters are built as plain Mongo objects; cast at the mongoose boundary
  const user = await User.findOne(filter).select(userFields);
  return user;
}

export async function hasConfirmedConflict(
  therapistId,
  start,
  end,
  appointmentId = null,
) {
  const filter = {
    therapist: therapistId,
    status: "confirmed",
    ...(appointmentId ? { _id: { $ne: appointmentId } } : {}),
    scheduledStart: { $lt: end },
    scheduledEnd: { $gt: start },
  };
  // filter is a plain Mongo object; cast at the mongoose boundary
  return Boolean(await Appointment.exists(filter));
}

export async function assignTherapist(appointment, therapistId, actorId, note) {
  const doc = raw(appointment);
  doc.therapist = new Types.ObjectId(therapistId);
  pushAudit(doc, actorId, "therapist_assigned", note);
  await doc.save();
}

export async function confirmAppointmentRecord(appointment, schedule, actorId) {
  const doc = raw(appointment);
  doc.scheduledStart = schedule.start;
  doc.scheduledEnd = schedule.end;
  doc.status = "confirmed";
  pushAudit(doc, actorId, "confirmed", "", "confirmed");
  await doc.save();
}

export async function applyReschedule(
  appointment,
  schedule,
  date,
  time,
  reason,
  actorId,
) {
  const doc = raw(appointment);
  doc.requestedDate = date;
  doc.requestedTime = time;
  doc.scheduledStart = schedule.start;
  doc.scheduledEnd = schedule.end;
  // A new time gets its own reminder windows.
  doc.remindersSentHours = [];
  doc.reminderSentAt = null;
  // Mongoose casts the partial object into the subdocument exactly as the previous JS did
  doc.rescheduleRequest = {
    status: "none",
  };
  pushAudit(doc, actorId, "rescheduled", reason, doc.status);
  await doc.save();
}

export async function declineRescheduleRequest(appointment, actorId, reason) {
  const doc = raw(appointment);
  doc.rescheduleRequest = {
    status: "none",
  };
  pushAudit(doc, actorId, "reschedule_declined", reason);
  await doc.save();
}

export async function cancelAppointmentRecord(appointment, actorId, reason) {
  const doc = raw(appointment);
  // A cancelled appointment must not keep surfacing under the `rescheduled` filter.
  const hadOpenRequest = doc.rescheduleRequest?.status === "requested";
  doc.status = "cancelled";
  doc.cancelReason = reason;
  doc.cancelledBy = new Types.ObjectId(actorId);
  if (hadOpenRequest) {
    doc.rescheduleRequest = {
      status: "none",
    };
  }
  pushAudit(
    doc,
    actorId,
    "cancelled",
    hadOpenRequest ? `${reason} (open reschedule request withdrawn)` : reason,
    "cancelled",
  );
  await doc.save();
}
