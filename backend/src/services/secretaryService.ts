import {
  Types,
  type QueryFilter,
  type HydratedDocument,
  type UpdateQuery,
} from "mongoose";
import Appointment, {
  type Appointment as AppointmentData,
  type AppointmentPayment,
} from "../models/appointmentModel.js";
import User, {
  type User as UserData,
  type UserDoc,
} from "../models/userModel.js";
import { assertNotStale, freshFilter } from "./concurrencyService.js";

const appointmentPopulate = [
  { path: "patient", select: "firstname lastname email phone profilePicture" },
  { path: "dependent", select: "firstName lastName dateOfBirth relationship" },
  {
    path: "therapist",
    select: "firstname lastname specialization profilePicture",
  },
  { path: "service", select: "name description duration fee" },
  { path: "payment.recordedBy", select: "firstname lastname" },
  { path: "paymentAudit.by", select: "firstname lastname" },
];

export interface PopulatedPatient {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  profilePicture: string;
}

export interface PopulatedTherapist {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
  specialization: string | string[];
  profilePicture: string;
}

export interface PopulatedDependent {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  relationship: string;
}

export interface PopulatedService {
  _id: Types.ObjectId;
  name: string;
  description: string;
  duration: number;
  fee: number;
}

export type SecretaryAppointment = HydratedDocument<
  Omit<AppointmentData, "patient" | "dependent" | "therapist" | "service"> & {
    patient: PopulatedPatient | null;
    dependent: PopulatedDependent | null;
    therapist: PopulatedTherapist | null;
    service: PopulatedService | null;
    payment?: AppointmentPayment;
  }
>;

export interface PaymentInput {
  amount: number;
  method: string;
  referenceNumber: string;
  notes: string;
}

export interface PaymentHistoryEntry {
  action: string;
  by: string | null;
  details: string;
  at: Date | null;
}

export interface PaymentAuditInput {
  action: string;
  by: string;
  details: string;
}

export interface ScheduleFilters {
  status?: string | undefined;
  therapist?: string | undefined;
  date?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

function dateRange(filters: ScheduleFilters): (string | undefined)[] {
  const today = new Date();
  if (filters.date === "today") {
    const value = today.toLocaleDateString("en-CA", {
      timeZone: "Asia/Manila",
    });
    return [`${value}T00:00:00+08:00`, `${value}T23:59:59+08:00`];
  }
  if (filters.date === "week") {
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "Asia/Manila",
    }).format(today);
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      weekday,
    );
    const start = new Date(today);
    start.setDate(today.getDate() - ((day + 6) % 7));
    return [
      start.toISOString(),
      new Date(start.getTime() + 7 * 86400000).toISOString(),
    ];
  }
  return [filters.from, filters.to];
}

function scheduleQuery(filters: ScheduleFilters): Record<string, unknown> {
  const status = filters.status || "confirmed";
  const query: Record<string, unknown> = status === "all" ? {} : { status };
  if (!filters.status) query.scheduledStart = { $gte: new Date() };
  if (filters.therapist) query.therapist = filters.therapist;
  const [from, to] = dateRange(filters);
  if (from || to)
    query.scheduledStart = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  return query;
}

export async function getProfile(userId: string): Promise<UserDoc | null> {
  const user = await User.findById(userId).select("-password -accountAudit");
  // mongoose 9 drops instance-method typing on .select(); the doc has them.
  return user as unknown as UserDoc | null;
}

export async function updateProfile(
  userId: string,
  updates: Record<string, unknown>,
  ifMatch?: string,
): Promise<UserDoc | null> {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const user = await User.findOneAndUpdate(
    { _id: userId, ...freshFilter(ifMatch) } as QueryFilter<UserData>,
    {
      $set: updates,
      $push: { accountAudit: { action: "profile_updated", by: userId } },
    } as UpdateQuery<UserData>,
    { new: true, runValidators: true },
  ).select("-password -accountAudit");
  if (!user) await assertNotStale(ifMatch, () => User.exists({ _id: userId }));
  return user as unknown as UserDoc | null;
}

export async function searchTherapists(): Promise<UserDoc[]> {
  return User.find({
    role: "therapist",
    isActive: true,
  } as QueryFilter<UserData>)
    .select("firstname lastname")
    .sort({ lastname: 1, firstname: 1 });
}

export async function listSchedule(
  filters: ScheduleFilters,
): Promise<SecretaryAppointment[]> {
  const appointments = await Appointment.find(
    scheduleQuery(filters) as QueryFilter<AppointmentData>,
  )
    .populate(appointmentPopulate)
    .sort({ scheduledStart: 1, requestedDate: 1 });
  // populate() replaces the refs with documents at runtime; the schema types them as ids.
  return appointments as unknown as SecretaryAppointment[];
}

export async function getAppointmentForPayment(
  appointmentId: string,
): Promise<SecretaryAppointment | null> {
  const appointment =
    await Appointment.findById(appointmentId).populate(appointmentPopulate);
  return appointment as unknown as SecretaryAppointment | null;
}

export async function listPaymentAppointments(
  status: string | undefined,
): Promise<SecretaryAppointment[]> {
  const query: Record<string, unknown> = {
    status: { $in: ["confirmed", "completed"] },
  };
  if (status === "paid") query["payment.status"] = "paid";
  if (status === "unpaid")
    query.$or = [
      { "payment.status": "unpaid" },
      { payment: { $exists: false } },
    ];
  const appointments = await Appointment.find(
    query as QueryFilter<AppointmentData>,
  )
    .populate(appointmentPopulate)
    .sort({ scheduledStart: 1 });
  return appointments as unknown as SecretaryAppointment[];
}

export async function applyPaidPayment(
  appointment: SecretaryAppointment,
  payment: PaymentInput,
  audit: PaymentAuditInput,
): Promise<SecretaryAppointment> {
  appointment.payment = {
    ...payment,
    method: payment.method as AppointmentPayment["method"],
    status: "paid",
    recordedBy: new Types.ObjectId(audit.by),
    recordedAt: new Date(),
  };
  appointment.paymentAudit.push({
    action: audit.action,
    by: new Types.ObjectId(audit.by),
    details: audit.details,
  });
  await appointment.save();
  return appointment;
}

export async function applyUnpaidPayment(
  appointment: SecretaryAppointment,
  reason: string,
  audit: PaymentAuditInput,
): Promise<SecretaryAppointment> {
  appointment.payment = appointment.payment || ({} as AppointmentPayment);
  appointment.payment.status = "unpaid";
  appointment.payment.notes = reason;
  appointment.paymentAudit.push({
    action: audit.action,
    by: new Types.ObjectId(audit.by),
    details: audit.details,
  });
  await appointment.save();
  return appointment;
}
