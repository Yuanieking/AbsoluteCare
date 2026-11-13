import { Types } from "mongoose";
import Appointment from "../models/appointmentModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import {
  isValidFutureDate,
  manilaDateTime,
} from "../utils/appointmentDates.js";
import {
  assertNotStale,
  freshFilter,
  guardFresh,
} from "./concurrencyService.js";

const servicePopulation = {
  path: "service",
  select: "name description duration fee",
};
const patientPopulation = {
  path: "patient",
  select: "firstname lastname email phone profilePicture",
};
const dependentPopulation = {
  path: "dependent",
  select: "firstName lastName dateOfBirth relationship",
};

function appointmentQuery(status) {
  const now = new Date();
  if (status === "upcoming")
    return { status: "confirmed", scheduledStart: { $gte: now } };
  if (status === "previous")
    return {
      $or: [
        { status: { $in: ["completed", "cancelled", "no_show"] } },
        { status: "confirmed", scheduledStart: { $lt: now } },
      ],
    };
  return {};
}

export async function getProfile(therapistId) {
  const user = await User.findById(therapistId).select("-password");
  // mongoose 9 drops instance-method typing on .select(); the doc has them.
  return user;
}

export async function updateProfile(therapistId, updates, ifMatch) {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const user = await User.findOneAndUpdate(
    { _id: therapistId, ...freshFilter(ifMatch) },
    updates,
    { new: true, runValidators: true },
  ).select("-password");
  if (!user)
    await assertNotStale(ifMatch, () => User.exists({ _id: therapistId }));
  return user;
}

export async function listAppointments(therapistId, status) {
  const query = {
    therapist: therapistId,
    ...appointmentQuery(status),
  };
  return Appointment.find(query)
    .populate([servicePopulation, patientPopulation, dependentPopulation])
    .sort({ scheduledStart: status === "previous" ? -1 : 1 });
}

export async function getAppointment(therapistId, appointmentId) {
  return Appointment.findOne({
    _id: appointmentId,
    therapist: therapistId,
  }).populate([servicePopulation, patientPopulation, dependentPopulation]);
}

export async function findOwnAppointment(therapistId, appointmentId) {
  return Appointment.findOne({
    _id: appointmentId,
    therapist: therapistId,
  });
}

export async function listPatientRecords(therapistId) {
  const appointments = await Appointment.find({
    therapist: therapistId,
  })
    .populate("dependent", "firstName lastName relationship")
    .select("patient dependent scheduledStart status")
    .sort({ scheduledStart: 1 });
  const sessions = await Session.find({
    therapist: therapistId,
  })
    .select("patient sessionDate")
    .sort({ sessionDate: -1 });
  const patientIds = [
    ...new Set(appointments.map((item) => item.patient.toString())),
  ].map((id) => new Types.ObjectId(id));
  const users = await User.find({
    _id: { $in: patientIds },
  }).select("firstname lastname email phone profilePicture");
  return { appointments, sessions, users };
}

export async function listAdminIds() {
  const admins = await User.find({
    role: "admin",
    isActive: true,
    isArchived: false,
    removedAt: null,
  }).select("_id");
  return admins.map((admin) => admin._id);
}

export async function requestReschedule(therapistId, appointmentId, input) {
  const appointment = await findOwnAppointment(therapistId, appointmentId);
  if (!appointment)
    return { ok: false, status: 404, message: "Appointment not found." };
  if (!["pending", "confirmed"].includes(appointment.status))
    return {
      ok: false,
      status: 400,
      message: `A ${appointment.status.replace("_", "-")} appointment can no longer be rescheduled.`,
    };
  const currentStart =
    appointment.scheduledStart ||
    manilaDateTime(appointment.requestedDate, appointment.requestedTime);
  if (currentStart <= new Date())
    return {
      ok: false,
      status: 400,
      message:
        "This appointment has already passed and can no longer be rescheduled.",
    };
  if (!isValidFutureDate(input.proposedDate, input.proposedTime))
    return {
      ok: false,
      status: 400,
      message: "Choose a future reschedule date and time.",
    };
  appointment.rescheduleRequest = {
    status: "requested",
    proposedDate: input.proposedDate,
    proposedTime: input.proposedTime,
    reason: input.reason,
    requestedBy: "therapist",
    requestedAt: new Date(),
  };
  await appointment.save();
  return { ok: true, appointment };
}

export async function markNoShow(therapistId, appointmentId, ifMatch) {
  const appointment = await findOwnAppointment(therapistId, appointmentId);
  if (!appointment)
    return { ok: false, status: 404, message: "Appointment not found." };
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, ifMatch);
  if (appointment.status !== "confirmed")
    return {
      ok: false,
      status: 409,
      message: `Cannot mark an appointment with status "${appointment.status}" as no-show.`,
    };
  if (!appointment.scheduledStart || appointment.scheduledStart > new Date())
    return {
      ok: false,
      status: 409,
      message:
        "This appointment can be marked no-show once its start time has passed.",
    };
  const markedBy = new Types.ObjectId(therapistId);
  appointment.status = "no_show";
  appointment.noShowMarkedBy = markedBy;
  appointment.noShowMarkedRole = "therapist";
  appointment.noShowMarkedAt = new Date();
  appointment.auditLog.push({
    action: "no_show",
    by: markedBy,
    fromStatus: "confirmed",
    toStatus: "no_show",
    details: "Marked no-show by therapist.",
  });
  await appointment.save();
  return { ok: true, appointment };
}

export async function createSessionForAppointment(
  therapistId,
  appointmentId,
  input,
) {
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    therapist: therapistId,
  }).populate("service");
  if (!appointment)
    return { ok: false, status: 404, message: "Appointment not found." };
  if (
    appointment.status !== "confirmed" ||
    !appointment.scheduledStart ||
    appointment.scheduledStart > new Date()
  )
    return {
      ok: false,
      status: 400,
      message:
        "Sessions can be recorded after a confirmed appointment has passed.",
    };
  const sessionDate = new Date(input.sessionDate);
  const durationMinutes = Number(input.durationMinutes);
  if (
    Number.isNaN(sessionDate.getTime()) ||
    sessionDate > new Date() ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1
  )
    return {
      ok: false,
      status: 400,
      message: "Enter a valid past date and duration.",
    };
  // populate() resolves the ref at runtime; the schema still types it as an id.
  const serviceId = appointment.service._id;
  const session = await Session.create({
    appointment: appointment._id,
    patient: appointment.patient,
    dependent: appointment.dependent || null,
    therapist: new Types.ObjectId(therapistId),
    service: serviceId,
    sessionDate,
    durationMinutes,
    patientVisibleNotes: input.patientVisibleNotes?.trim() || "",
    clinicalNotes: input.clinicalNotes?.trim() || "",
  });
  appointment.status = "completed";
  await appointment.save();
  return { ok: true, session, appointment };
}

export async function listSessions(therapistId, patient, appointmentId) {
  const query = { therapist: therapistId };
  if (patient) query.patient = patient;
  if (appointmentId) query.appointment = appointmentId;
  return Session.find(query)
    .populate([servicePopulation, patientPopulation, dependentPopulation])
    .sort({ sessionDate: -1 });
}

export async function getSession(therapistId, sessionId) {
  return Session.findOne({
    _id: sessionId,
    therapist: therapistId,
  }).populate([servicePopulation, patientPopulation, dependentPopulation]);
}

export async function updateSession(therapistId, sessionId, changes, ifMatch) {
  const session = await Session.findOne({
    _id: sessionId,
    therapist: therapistId,
  });
  if (!session) return null;
  // ** Concurrency: reject if the session notes changed since the client read them.
  guardFresh(session, ifMatch);
  if (changes.sessionDate !== undefined)
    session.sessionDate = new Date(changes.sessionDate);
  if (changes.durationMinutes !== undefined)
    session.durationMinutes = Number(changes.durationMinutes);
  if (changes.patientVisibleNotes !== undefined)
    session.patientVisibleNotes = changes.patientVisibleNotes.trim();
  if (changes.clinicalNotes !== undefined)
    session.clinicalNotes = changes.clinicalNotes.trim();
  session.editedAt = new Date();
  session.editHistory.push({
    editedBy: new Types.ObjectId(therapistId),
    editedAt: session.editedAt,
  });
  await session.save();
  return session;
}

export async function getCalendar(therapistId) {
  const user = await User.findById(therapistId).select("googleCalendar");
  return user;
}
