import {
  Types,
  type QueryFilter,
  type HydratedDocument,
  type PopulateOptions,
} from "mongoose";
import Appointment, {
  type Appointment as AppointmentRecord,
} from "../models/appointmentModel.js";
import Session, {
  type Session as SessionRecord,
} from "../models/sessionModel.js";
import User, { type User as UserRecord } from "../models/userModel.js";

interface MonitoringPatient {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
}

interface MonitoringTherapist {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
  specialization: string | string[];
}

interface MonitoringService {
  _id: Types.ObjectId;
  name: string;
  duration: number;
  fee: number;
}

export interface MonitoringAppointment extends Omit<
  AppointmentRecord,
  "patient" | "therapist" | "service"
> {
  patient: MonitoringPatient;
  therapist: MonitoringTherapist | null;
  service: MonitoringService;
}

export type MonitoringAppointmentDoc = HydratedDocument<MonitoringAppointment>;

interface MonitoringSessionPatient {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
  email: string;
}

interface MonitoringSessionTherapist {
  _id: Types.ObjectId;
  firstname: string;
  lastname: string;
}

interface MonitoringSessionService {
  _id: Types.ObjectId;
  name: string;
}

export interface MonitoringSession extends Omit<
  SessionRecord,
  "patient" | "therapist" | "service"
> {
  patient: MonitoringSessionPatient;
  therapist: MonitoringSessionTherapist;
  service: MonitoringSessionService;
}

export type MonitoringSessionDoc = HydratedDocument<MonitoringSession>;

export interface StatusCountRow {
  _id: string;
  count: number;
}

export interface SessionAggregateRow {
  _id: string | null;
  count: number;
  duration: number;
}

export interface WorkloadRow {
  _id: Types.ObjectId;
  name: string;
  assigned: number;
  completed: number;
}

export interface PaymentMethodRow {
  _id: string | null;
  total: number;
  count: number;
}

export interface UnpaidRow {
  _id: null;
  total: number;
  count: number;
}

export interface TopTherapistRow {
  name: string;
  count: number;
}

export interface DayCountRow {
  _id: string;
  count: number;
}

export interface DayTotalRow {
  _id: string;
  total: number;
}

export interface TrendPoint {
  date: string;
  requests: number;
  appointments: number;
  patients: number;
  outstanding: number;
}

export interface ReportData {
  patientCount: number;
  newPatients: number;
  completedPatients: number;
  appointments: StatusCountRow[];
  sessions: SessionAggregateRow[];
  therapistWorkload: WorkloadRow[];
  payments: PaymentMethodRow[];
  topTherapists: TopTherapistRow[];
  unpaid: UnpaidRow[];
  trend: TrendPoint[];
}

const TREND_DAYS = 30;
const DAY_MS = 86_400_000;

const dayOf = (field: string) => ({
  $dateToString: { format: "%Y-%m-%d", date: field },
});

function trendDays(from: Date, to: Date): string[] {
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const first = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const start = Math.max(first, end - (TREND_DAYS - 1) * DAY_MS);
  const days: string[] = [];
  for (let at = start; at <= end; at += DAY_MS) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}

function sumBefore(
  rows: { _id: string; value: number }[],
  day: string,
): number {
  return rows.reduce(
    (total, row) => (row._id < day ? total + row.value : total),
    0,
  );
}

function valueOn(rows: { _id: string; value: number }[], day: string): number {
  return rows.find((row) => row._id === day)?.value ?? 0;
}

function buildTrend(
  from: Date,
  to: Date,
  series: {
    pending: { _id: string; value: number }[];
    patients: { _id: string; value: number }[];
    outstanding: { _id: string; value: number }[];
    scheduled: { _id: string; value: number }[];
  },
): TrendPoint[] {
  const days = trendDays(from, to);
  const start = days[0];
  if (!start) return [];
  let requests = sumBefore(series.pending, start);
  let patients = sumBefore(series.patients, start);
  let outstanding = sumBefore(series.outstanding, start);
  return days.map((date) => {
    requests += valueOn(series.pending, date);
    patients += valueOn(series.patients, date);
    outstanding += valueOn(series.outstanding, date);
    return {
      date,
      requests,
      patients,
      outstanding,
      appointments: valueOn(series.scheduled, date),
    };
  });
}

const appointmentPopulation: PopulateOptions[] = [
  { path: "patient", select: "firstname lastname email phone" },
  { path: "therapist", select: "firstname lastname specialization" },
  { path: "service", select: "name duration fee" },
  { path: "payment.recordedBy", select: "firstname lastname" },
  { path: "paymentAudit.by", select: "firstname lastname" },
];

const sessionPopulation: PopulateOptions[] = [
  { path: "patient", select: "firstname lastname email" },
  { path: "therapist", select: "firstname lastname" },
  { path: "service", select: "name" },
];

export async function findAppointmentById(
  id: string,
): Promise<MonitoringAppointmentDoc | null> {
  const appointment = await Appointment.findById(id).populate(
    appointmentPopulation,
  );
  return appointment as unknown as MonitoringAppointmentDoc | null;
}

function raw(
  appointment: MonitoringAppointmentDoc,
): HydratedDocument<AppointmentRecord> {
  // populate() swaps ObjectId refs for documents at runtime; Mongoose keeps typing them as ObjectIds
  return appointment as unknown as HydratedDocument<AppointmentRecord>;
}

export async function completeAppointmentRecord(
  appointment: MonitoringAppointmentDoc,
  actorId: string,
): Promise<void> {
  const doc = raw(appointment);
  doc.status = "completed";
  doc.auditLog.push({
    action: "completed",
    by: new Types.ObjectId(actorId),
    fromStatus: "confirmed",
    toStatus: "completed",
    details: "Marked completed by admin.",
  });
  await doc.save();
}

export async function markAppointmentNoShow(
  appointment: MonitoringAppointmentDoc,
  actorId: string,
): Promise<void> {
  const doc = raw(appointment);
  const markedBy = new Types.ObjectId(actorId);
  doc.status = "no_show";
  doc.noShowMarkedBy = markedBy;
  doc.noShowMarkedRole = "admin";
  doc.noShowMarkedAt = new Date();
  doc.auditLog.push({
    action: "no_show",
    by: markedBy,
    fromStatus: "confirmed",
    toStatus: "no_show",
    details: "Marked no-show by admin.",
  });
  await doc.save();
}

export async function findSessions(
  filter: Record<string, unknown>,
): Promise<MonitoringSessionDoc[]> {
  const sessions = await Session.find(
    filter as QueryFilter<SessionRecord>,
  ).populate(sessionPopulation);
  return sessions as unknown as MonitoringSessionDoc[];
}

export async function findPayments(
  filter: Record<string, unknown>,
): Promise<MonitoringAppointmentDoc[]> {
  const appointments = await Appointment.find(
    filter as QueryFilter<AppointmentRecord>,
  )
    .populate(appointmentPopulation)
    .sort({ scheduledStart: -1 });
  return appointments as unknown as MonitoringAppointmentDoc[];
}

export async function findPaidAppointments(
  filter: Record<string, unknown>,
): Promise<MonitoringAppointmentDoc[]> {
  const appointments = await Appointment.find(
    filter as QueryFilter<AppointmentRecord>,
  )
    .populate(appointmentPopulation)
    .sort({ scheduledStart: 1 });
  return appointments as unknown as MonitoringAppointmentDoc[];
}

export async function getReportData(from: Date, to: Date): Promise<ReportData> {
  const createdAtRange = { $gte: from, $lte: to };
  const scheduledMatch = { scheduledStart: { $gte: from, $lte: to } };
  const [
    patientCount,
    newPatients,
    completedPatientIds,
    appointments,
    sessions,
    therapistWorkload,
    payments,
    topTherapists,
    unpaid,
    pendingByDay,
    patientsByDay,
    outstandingByDay,
    scheduledByDay,
  ] = await Promise.all([
    User.countDocuments({ role: "user", removedAt: null }),
    User.countDocuments({
      role: "user",
      createdAt: createdAtRange,
      removedAt: null,
    } as unknown as QueryFilter<UserRecord>),
    Session.distinct("patient", {
      sessionDate: { $gte: from, $lte: to },
    }),
    Appointment.aggregate<StatusCountRow>([
      { $match: scheduledMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Session.aggregate<SessionAggregateRow>([
      { $match: { sessionDate: { $gte: from, $lte: to } } },
      {
        $lookup: {
          from: "therapyservices",
          localField: "service",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$service.name",
          count: { $sum: 1 },
          duration: { $sum: "$durationMinutes" },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Appointment.aggregate<WorkloadRow>([
      { $match: scheduledMatch },
      { $match: { therapist: { $ne: null } } },
      {
        $lookup: {
          from: "users",
          localField: "therapist",
          foreignField: "_id",
          as: "therapist",
        },
      },
      { $unwind: "$therapist" },
      {
        $group: {
          _id: "$therapist._id",
          name: {
            $first: {
              $concat: ["$therapist.firstname", " ", "$therapist.lastname"],
            },
          },
          assigned: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
      { $sort: { assigned: -1 } },
    ]),
    Appointment.aggregate<PaymentMethodRow>([
      { $match: { ...scheduledMatch, "payment.status": "paid" } },
      {
        $group: {
          _id: "$payment.method",
          total: { $sum: "$payment.amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Appointment.aggregate<TopTherapistRow>([
      { $match: scheduledMatch },
      { $match: { therapist: { $ne: null } } },
      { $group: { _id: "$therapist", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "therapist",
        },
      },
      { $unwind: "$therapist" },
      {
        $project: {
          _id: 0,
          name: {
            $concat: ["$therapist.firstname", " ", "$therapist.lastname"],
          },
          count: 1,
        },
      },
    ]),
    Appointment.aggregate<UnpaidRow>([
      {
        $match: { ...scheduledMatch, "payment.status": { $ne: "paid" } },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$serviceSnapshot.fee", 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
    Appointment.aggregate<DayCountRow>([
      { $match: { status: "pending", createdAt: { $lte: to } } },
      { $group: { _id: dayOf("$createdAt"), count: { $sum: 1 } } },
    ]),
    User.aggregate<DayCountRow>([
      {
        $match: {
          role: "user",
          removedAt: null,
          createdAt: { $lte: to },
        } as unknown as QueryFilter<UserRecord>,
      },
      { $group: { _id: dayOf("$createdAt"), count: { $sum: 1 } } },
    ]),
    Appointment.aggregate<DayTotalRow>([
      {
        $match: {
          scheduledStart: { $ne: null, $lte: to },
          "payment.status": { $ne: "paid" },
        },
      },
      {
        $group: {
          _id: dayOf("$scheduledStart"),
          total: { $sum: { $ifNull: ["$serviceSnapshot.fee", 0] } },
        },
      },
    ]),
    Appointment.aggregate<DayCountRow>([
      { $match: scheduledMatch },
      { $group: { _id: dayOf("$scheduledStart"), count: { $sum: 1 } } },
    ]),
  ]);
  const trend = buildTrend(from, to, {
    pending: pendingByDay.map((row) => ({ _id: row._id, value: row.count })),
    patients: patientsByDay.map((row) => ({ _id: row._id, value: row.count })),
    outstanding: outstandingByDay.map((row) => ({
      _id: row._id,
      value: row.total,
    })),
    scheduled: scheduledByDay.map((row) => ({
      _id: row._id,
      value: row.count,
    })),
  });
  return {
    patientCount,
    newPatients,
    completedPatients: completedPatientIds.length,
    appointments,
    sessions,
    therapistWorkload,
    payments,
    topTherapists,
    unpaid,
    trend,
  };
}
