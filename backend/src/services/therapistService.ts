import {
  Types,
  type QueryFilter,
  type HydratedDocument,
  type UpdateQuery,
} from "mongoose";
import Appointment, {
  type Appointment as AppointmentData,
  type AppointmentDoc,
} from "../models/appointmentModel.js";
import Session, {
  type Session as SessionData,
} from "../models/sessionModel.js";
import User, {
  type User as UserData,
  type UserDoc,
} from "../models/userModel.js";
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

export type TherapistActionResult =
  | { ok: false; status: number; message: string }
  | { ok: true; appointment: AppointmentDoc };

export type CreateSessionResult =
  | { ok: false; status: number; message: string }
  | {
      ok: true;
      session: HydratedDocument<SessionData>;
      appointment: AppointmentDoc;
    };

export interface SessionChanges {
  sessionDate?: string | number | Date | undefined;
  durationMinutes?: string | number | undefined;
  patientVisibleNotes?: string | undefined;
  clinicalNotes?: string | undefined;
}

export interface SessionInput {
  sessionDate: string | number | Date;
  durationMinutes: string | number;
  patientVisibleNotes?: string;
  clinicalNotes?: string;
}

function appointmentQuery(status: string | undefined): Record<string, unknown> {
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

export async function getProfile(therapistId: string): Promise<UserDoc | null> {
  const user = await User.findById(therapistId).select("-password");
  // mongoose 9 drops instance-method typing on .select(); the doc has them.
  return user as unknown as UserDoc | null;
}

export async function updateProfile(
  therapistId: string,
  updates: Record<string, unknown>,
  ifMatch?: string,
): Promise<UserDoc | null> {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const user = await User.findOneAndUpdate(
    { _id: therapistId, ...freshFilter(ifMatch) } as QueryFilter<UserData>,
    updates as UpdateQuery<UserData>,
    { new: true, runValidators: true },
  ).select("-password");
  if (!user)
    await assertNotStale(ifMatch, () => User.exists({ _id: therapistId }));
  return user as unknown as UserDoc | null;
}

export async function listAppointments(
  therapistId: string,
  status: string | undefined,
): Promise<AppointmentDoc[]> {
  const query = {
    therapist: therapistId,
    ...appointmentQuery(status),
  } as QueryFilter<AppointmentData>;
  return Appointment.find(query)
    .populate([servicePopulation, patientPopulation, dependentPopulation])
    .sort({ scheduledStart: status === "previous" ? -1 : 1 });
}

export async function getAppointment(
  therapistId: string,
  appointmentId: string,
): Promise<AppointmentDoc | null> {
  return Appointment.findOne({
    _id: appointmentId,
    therapist: therapistId,
  } as QueryFilter<AppointmentData>).populate([
    servicePopulation,
    patientPopulation,
    dependentPopulation,
  ]);
}

export async function findOwnAppointment(
  therapistId: string,
  appointmentId: string,
): Promise<AppointmentDoc | null> {
  return Appointment.findOne({
    _id: appointmentId,
    therapist: therapistId,
  } as QueryFilter<AppointmentData>);
}

export async function listPatientRecords(therapistId: string) {
  const appointments = await Appointment.find({
    therapist: therapistId,
  } as QueryFilter<AppointmentData>)
    .populate("dependent", "firstName lastName relationship")
    .select("patient dependent scheduledStart status")
    .sort({ scheduledStart: 1 });
  const sessions = await Session.find({
    therapist: therapistId,
  } as QueryFilter<SessionData>)
    .select("patient sessionDate")
    .sort({ sessionDate: -1 });
  const patientIds = [
    ...new Set(appointments.map((item) => item.patient.toString())),
  ].map((id) => new Types.ObjectId(id));
  const users = await User.find({
    _id: { $in: patientIds },
  } as QueryFilter<UserData>).select(
    "firstname lastname email phone profilePicture",
  );
  return { appointments, sessions, users };
}

export async function listAdminIds(): Promise<Types.ObjectId[]> {
  const admins = await User.find({
    role: "admin",
    isActive: true,
    isArchived: false,
    removedAt: null,
  } as QueryFilter<UserData>).select("_id");
  return admins.map((admin) => admin._id);
}

export async function requestReschedule(
  therapistId: string,
  appointmentId: string,
  input: { proposedDate: string; proposedTime: string; reason: string },
): Promise<TherapistActionResult> {
  const appointment = await findOwnAppointment(therapistId, appointmentId);
  if (!appointment)
    return { ok: false, status: 404, message: "Appointment not found." };
  const currentStart =
    appointment.scheduledStart ||
    manilaDateTime(appointment.requestedDate, appointment.requestedTime);
  if (
    !["pending", "confirmed"].includes(appointment.status) ||
    currentStart <= new Date() ||
    !isValidFutureDate(input.proposedDate, input.proposedTime)
  )
    return {
      ok: false,
      status: 400,
      message: "Choose a future date and time for an active appointment.",
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

export async function markNoShow(
  therapistId: string,
  appointmentId: string,
  ifMatch?: string,
): Promise<TherapistActionResult> {
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
  therapistId: string,
  appointmentId: string,
  input: SessionInput,
): Promise<CreateSessionResult> {
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    therapist: therapistId,
  } as QueryFilter<AppointmentData>).populate("service");
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
  const serviceId = (appointment.service as unknown as { _id: Types.ObjectId })
    ._id;
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

export async function listSessions(
  therapistId: string,
  patient: string | undefined,
  appointmentId: string | undefined,
): Promise<HydratedDocument<SessionData>[]> {
  const query: Record<string, unknown> = { therapist: therapistId };
  if (patient) query.patient = patient;
  if (appointmentId) query.appointment = appointmentId;
  return Session.find(query as QueryFilter<SessionData>)
    .populate([servicePopulation, patientPopulation, dependentPopulation])
    .sort({ sessionDate: -1 });
}

export async function getSession(
  therapistId: string,
  sessionId: string,
): Promise<HydratedDocument<SessionData> | null> {
  return Session.findOne({
    _id: sessionId,
    therapist: therapistId,
  } as QueryFilter<SessionData>).populate([
    servicePopulation,
    patientPopulation,
    dependentPopulation,
  ]);
}

export async function updateSession(
  therapistId: string,
  sessionId: string,
  changes: SessionChanges,
  ifMatch?: string,
): Promise<HydratedDocument<SessionData> | null> {
  const session = await Session.findOne({
    _id: sessionId,
    therapist: therapistId,
  } as QueryFilter<SessionData>);
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

export async function getCalendar(
  therapistId: string,
): Promise<UserDoc | null> {
  const user = await User.findById(therapistId).select("googleCalendar");
  return user as unknown as UserDoc | null;
}
