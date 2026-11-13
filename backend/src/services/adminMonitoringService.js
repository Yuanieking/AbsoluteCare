import { Types } from "mongoose";
import Appointment from "../models/appointmentModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";

const TREND_DAYS = 30;
const DAY_MS = 86_400_000;

const dayOf = (field) => ({
  $dateToString: { format: "%Y-%m-%d", date: field },
});

function trendDays(from, to) {
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const first = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const start = Math.max(first, end - (TREND_DAYS - 1) * DAY_MS);
  const days = [];
  for (let at = start; at <= end; at += DAY_MS) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}

function sumBefore(rows, day) {
  return rows.reduce(
    (total, row) => (row._id < day ? total + row.value : total),
    0,
  );
}

function valueOn(rows, day) {
  return rows.find((row) => row._id === day)?.value ?? 0;
}

function buildTrend(from, to, series) {
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

const appointmentPopulation = [
  { path: "patient", select: "firstname lastname email phone" },
  { path: "therapist", select: "firstname lastname specialization" },
  { path: "service", select: "name duration fee" },
  { path: "payment.recordedBy", select: "firstname lastname" },
  { path: "paymentAudit.by", select: "firstname lastname" },
];

const sessionPopulation = [
  { path: "patient", select: "firstname lastname email" },
  { path: "therapist", select: "firstname lastname" },
  { path: "service", select: "name" },
];

export async function findAppointmentById(id) {
  const appointment = await Appointment.findById(id).populate(
    appointmentPopulation,
  );
  return appointment;
}

function raw(appointment) {
  // populate() swaps ObjectId refs for documents at runtime; Mongoose keeps typing them as ObjectIds
  return appointment;
}

export async function completeAppointmentRecord(appointment, actorId) {
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

export async function markAppointmentNoShow(appointment, actorId) {
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

export async function findSessions(filter) {
  const sessions = await Session.find(filter).populate(sessionPopulation);
  return sessions;
}

export async function findPayments(filter) {
  const appointments = await Appointment.find(filter)
    .populate(appointmentPopulation)
    .sort({ scheduledStart: -1 });
  return appointments;
}

export async function findPaidAppointments(filter) {
  const appointments = await Appointment.find(filter)
    .populate(appointmentPopulation)
    .sort({ scheduledStart: 1 });
  return appointments;
}

export async function getReportData(from, to) {
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
    }),
    Session.distinct("patient", {
      sessionDate: { $gte: from, $lte: to },
    }),
    Appointment.aggregate([
      { $match: scheduledMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Session.aggregate([
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
    Appointment.aggregate([
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
    Appointment.aggregate([
      { $match: { ...scheduledMatch, "payment.status": "paid" } },
      {
        $group: {
          _id: "$payment.method",
          total: { $sum: "$payment.amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Appointment.aggregate([
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
    Appointment.aggregate([
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
    Appointment.aggregate([
      { $match: { status: "pending", createdAt: { $lte: to } } },
      { $group: { _id: dayOf("$createdAt"), count: { $sum: 1 } } },
    ]),
    User.aggregate([
      {
        $match: {
          role: "user",
          removedAt: null,
          createdAt: { $lte: to },
        },
      },
      { $group: { _id: dayOf("$createdAt"), count: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
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
    Appointment.aggregate([
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
