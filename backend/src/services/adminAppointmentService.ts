import {
  Types,
  type QueryFilter,
  type HydratedDocument,
  type PopulateOptions,
} from "mongoose";
import Appointment, {
  type Appointment as AppointmentRecord,
  type AppointmentDoc,
} from "../models/appointmentModel.js";
import User, {
  type DayHours,
  type User as UserRecord,
  type UserDoc,
  type WorkingHours,
} from "../models/userModel.js";

const userFields =
  "firstname lastname email phone profilePicture specialization workingDays workingHours workingHoursByDay googleCalendar.connected";

interface PopulatedPatient {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  profilePicture: string;
}

interface PopulatedDependent {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  relationship: string;
}

interface PopulatedTherapist {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  profilePicture: string;
  specialization: string | string[];
  workingDays: string[];
  workingHoursByDay: DayHours[];
  workingHours: WorkingHours;
  googleCalendar: { connected: boolean };
}

export interface PopulatedService {
  _id: Types.ObjectId;
  name: string;
  description: string;
  duration: number;
  fee: number;
}

export interface PopulatedAppointment extends Omit<
  AppointmentRecord,
  "patient" | "dependent" | "therapist" | "service"
> {
  patient: PopulatedPatient;
  dependent: PopulatedDependent | null;
  therapist: PopulatedTherapist | null;
  service: PopulatedService;
}

export type PopulatedAppointmentDoc = HydratedDocument<PopulatedAppointment>;
export type TherapistUserDoc = UserDoc;
export type AppointmentSchedule = { start: Date; end: Date };
export type AppointmentSort = Record<string, 1 | -1>;

const populatePaths: PopulateOptions[] = [
  { path: "patient", select: "firstname lastname email phone profilePicture" },
  { path: "dependent", select: "firstName lastName dateOfBirth relationship" },
  { path: "therapist", select: userFields },
  { path: "service", select: "name description duration fee" },
];

function raw(appointment: PopulatedAppointmentDoc): AppointmentDoc {
  // populate() swaps ObjectId refs for documents at runtime; Mongoose keeps typing them as ObjectIds
  return appointment as unknown as AppointmentDoc;
}

function pushAudit(
  appointment: AppointmentDoc,
  actorId: string,
  action: string,
  details = "",
  toStatus = appointment.status,
): void {
  appointment.auditLog.push({
    action,
    by: new Types.ObjectId(actorId),
    fromStatus: appointment.status,
    toStatus,
    details,
  });
}

export async function findAppointments(
  filter: Record<string, unknown>,
  sort: AppointmentSort,
): Promise<PopulatedAppointmentDoc[]> {
  const appointments = await Appointment.find(
    filter as QueryFilter<AppointmentRecord>,
  )
    .populate(populatePaths)
    .sort(sort);
  return appointments as unknown as PopulatedAppointmentDoc[];
}

export async function getAppointmentById(
  id: string,
): Promise<PopulatedAppointmentDoc | null> {
  const appointment = await Appointment.findById(id).populate(populatePaths);
  return appointment as unknown as PopulatedAppointmentDoc | null;
}

export async function repopulate(
  appointment: PopulatedAppointmentDoc,
): Promise<void> {
  await appointment.populate(populatePaths);
}

export async function findActiveTherapists(): Promise<UserDoc[]> {
  const therapists = await User.find({ role: "therapist", isActive: true })
    .select(userFields)
    .sort({ lastname: 1, firstname: 1 });
  // mongoose 9 drops instance-method typing on .select(); the docs have them.
  return therapists as unknown as UserDoc[];
}

export async function findActiveTherapistById(
  therapistId: Types.ObjectId | string,
): Promise<UserDoc | null> {
  const filter: Record<string, unknown> = {
    _id: therapistId,
    role: "therapist",
    isActive: true,
  };
  // filters are built as plain Mongo objects; cast at the mongoose boundary
  const user = await User.findOne(filter as QueryFilter<UserRecord>).select(
    userFields,
  );
  return user as unknown as UserDoc | null;
}

export async function hasConfirmedConflict(
  therapistId: Types.ObjectId | string,
  start: Date,
  end: Date,
  appointmentId: Types.ObjectId | null = null,
): Promise<boolean> {
  const filter: Record<string, unknown> = {
    therapist: therapistId,
    status: "confirmed",
    ...(appointmentId ? { _id: { $ne: appointmentId } } : {}),
    scheduledStart: { $lt: end },
    scheduledEnd: { $gt: start },
  };
  // filter is a plain Mongo object; cast at the mongoose boundary
  return Boolean(
    await Appointment.exists(filter as QueryFilter<AppointmentRecord>),
  );
}

export async function assignTherapist(
  appointment: PopulatedAppointmentDoc,
  therapistId: string,
  actorId: string,
  note: string,
): Promise<void> {
  const doc = raw(appointment);
  doc.therapist = new Types.ObjectId(therapistId);
  pushAudit(doc, actorId, "therapist_assigned", note);
  await doc.save();
}

export async function confirmAppointmentRecord(
  appointment: PopulatedAppointmentDoc,
  schedule: AppointmentSchedule,
  actorId: string,
): Promise<void> {
  const doc = raw(appointment);
  doc.scheduledStart = schedule.start;
  doc.scheduledEnd = schedule.end;
  doc.status = "confirmed";
  pushAudit(doc, actorId, "confirmed", "", "confirmed");
  await doc.save();
}

export async function applyReschedule(
  appointment: PopulatedAppointmentDoc,
  schedule: AppointmentSchedule,
  date: string,
  time: string,
  reason: string,
  actorId: string,
): Promise<void> {
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
  } as unknown as AppointmentRecord["rescheduleRequest"];
  pushAudit(doc, actorId, "rescheduled", reason, doc.status);
  await doc.save();
}

export async function declineRescheduleRequest(
  appointment: PopulatedAppointmentDoc,
  actorId: string,
  reason: string,
): Promise<void> {
  const doc = raw(appointment);
  doc.rescheduleRequest = {
    status: "none",
  } as unknown as AppointmentRecord["rescheduleRequest"];
  pushAudit(doc, actorId, "reschedule_declined", reason);
  await doc.save();
}

export async function cancelAppointmentRecord(
  appointment: PopulatedAppointmentDoc,
  actorId: string,
  reason: string,
): Promise<void> {
  const doc = raw(appointment);
  // A cancelled appointment must not keep surfacing under the `rescheduled` filter.
  const hadOpenRequest = doc.rescheduleRequest?.status === "requested";
  doc.status = "cancelled";
  doc.cancelReason = reason;
  doc.cancelledBy = new Types.ObjectId(actorId);
  if (hadOpenRequest) {
    doc.rescheduleRequest = {
      status: "none",
    } as unknown as AppointmentRecord["rescheduleRequest"];
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
