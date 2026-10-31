import Appointment from "../models/appointmentModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import TherapyService from "../models/therapyServiceModel.js";
import {
  notifyAppointmentCompleted,
  notifyAppointmentNoShow,
} from "../services/notificationService.js";

const population = [
  { path: "patient", select: "firstname lastname email phone" },
  { path: "therapist", select: "firstname lastname specialization" },
  { path: "service", select: "name duration fee" },
];

function dateFilter(query, field = "scheduledStart") {
  return {
    ...(query.from ? { [field]: { $gte: new Date(query.from) } } : {}),
    ...(query.to
      ? {
          [field]: {
            ...(query.from ? { $gte: new Date(query.from) } : {}),
            $lte: new Date(query.to),
          },
        }
      : {}),
  };
}

function searchText(item, search) {
  if (!search) return true;
  const value =
    `${item.patient?.firstname || ""} ${item.patient?.lastname || ""} ${item.patient?.email || ""} ${item.patient?.phone || ""} ${item.therapist?.firstname || ""} ${item.therapist?.lastname || ""} ${item.service?.name || ""}`.toLowerCase();
  return value.includes(search.toLowerCase());
}

export async function completeAppointment(req, res) {
  const appointment = await Appointment.findById(req.params.id).populate(
    population,
  );
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (appointment.status !== "confirmed")
    return res
      .status(409)
      .json({
        message: `Cannot complete an appointment with status "${appointment.status}".`,
      });
  if (!appointment.scheduledEnd || appointment.scheduledEnd > new Date())
    return res
      .status(409)
      .json({
        message:
          "An appointment can be completed after its scheduled end time.",
      });
  appointment.status = "completed";
  appointment.auditLog.push({
    action: "completed",
    by: req.user.userId,
    fromStatus: "confirmed",
    toStatus: "completed",
    details: "Marked completed by admin.",
  });
  await appointment.save();
  await notifyAppointmentCompleted(appointment);
  res.json({ appointment, message: "Appointment marked completed." });
}

export async function markNoShow(req, res) {
  const appointment = await Appointment.findById(req.params.id).populate(
    population,
  );
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (appointment.status !== "confirmed")
    return res
      .status(409)
      .json({
        message: `Cannot mark an appointment with status "${appointment.status}" as no-show.`,
      });
  if (!appointment.scheduledEnd || appointment.scheduledEnd > new Date())
    return res
      .status(409)
      .json({
        message:
          "An appointment can be marked no-show after its scheduled end time.",
      });
  appointment.status = "no_show";
  appointment.noShowMarkedBy = req.user.userId;
  appointment.noShowMarkedRole = "admin";
  appointment.noShowMarkedAt = new Date();
  appointment.auditLog.push({
    action: "no_show",
    by: req.user.userId,
    fromStatus: "confirmed",
    toStatus: "no_show",
    details: "Marked no-show by admin.",
  });
  await appointment.save();
  await notifyAppointmentNoShow(appointment);
  res.json({ appointment, message: "Appointment marked no-show." });
}

export async function listSessions(req, res) {
  const query = dateFilter(req.query, "sessionDate");
  const sessions = await Session.find(query)
    .populate([
      { path: "patient", select: "firstname lastname email" },
      { path: "therapist", select: "firstname lastname" },
      { path: "service", select: "name" },
    ])
    .sort({ sessionDate: -1 });
  const search = req.query.search?.trim().toLowerCase();
  const filtered = search
    ? sessions.filter((item) =>
        `${item.patient?.firstname} ${item.patient?.lastname} ${item.therapist?.firstname} ${item.therapist?.lastname} ${item.service?.name}`
          .toLowerCase()
          .includes(search),
      )
    : sessions;
  res.json({ sessions: filtered });
}

export async function listPayments(req, res) {
  const query = {
    status: { $in: ["confirmed", "completed"] },
    ...dateFilter(req.query),
  };
  if (req.query.status === "paid") query["payment.status"] = "paid";
  if (req.query.status === "unpaid") query["payment.status"] = { $ne: "paid" };
  const appointments = await Appointment.find(query)
    .populate(population)
    .sort({ scheduledStart: -1 });
  const search = req.query.search?.trim();
  res.json({
    appointments: appointments.filter((item) => searchText(item, search)),
  });
}

function range(query) {
  const from = query.from
    ? new Date(query.from)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = query.to ? new Date(query.to) : new Date();
  return { from, to };
}

export async function reports(req, res) {
  const { from, to } = range(req.query);
  const appointmentMatch = { createdAt: { $gte: from, $lte: to } };
  const scheduledMatch = { scheduledStart: { $gte: from, $lte: to } };
  const [
    patientCount,
    newPatients,
    appointments,
    sessions,
    therapistWorkload,
    payments,
    topTherapist,
  ] = await Promise.all([
    User.countDocuments({ role: "user", removedAt: null }),
    User.countDocuments({
      role: "user",
      createdAt: appointmentMatch.createdAt,
      removedAt: null,
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
  ]);
  const totalAppointments = appointments.reduce(
    (total, item) => total + item.count,
    0,
  );
  const completed =
    appointments.find((item) => item._id === "completed")?.count || 0;
  const revenue = payments.reduce((total, item) => total + item.total, 0);
  const unpaid = await Appointment.aggregate([
    { $match: { ...scheduledMatch, "payment.status": { $ne: "paid" } } },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$serviceSnapshot.fee", 0] } },
        count: { $sum: 1 },
      },
    },
  ]);
  res.json({
    range: { from, to },
    patients: { total: patientCount, new: newPatients },
    appointments: {
      total: totalAppointments,
      byStatus: appointments,
      completionRate: totalAppointments ? completed / totalAppointments : 0,
    },
    sessions,
    therapistWorkload,
    payments: {
      byMethod: payments,
      revenue,
      unpaid: unpaid[0] || { total: 0, count: 0 },
    },
    topTherapist: topTherapist[0] || null,
  });
}

export async function exportPayments(req, res) {
  const appointments = await Appointment.find({
    ...dateFilter(req.query),
    "payment.status": "paid",
  })
    .populate(population)
    .sort({ scheduledStart: 1 });
  const rows = ["Date,Patient,Therapist,Service,Amount,Method,Reference"];
  appointments.forEach((item) =>
    rows.push(
      [
        item.scheduledStart?.toISOString() || "",
        `${item.patient?.firstname || ""} ${item.patient?.lastname || ""}`,
        `${item.therapist?.firstname || ""} ${item.therapist?.lastname || ""}`,
        item.service?.name || item.serviceSnapshot?.name || "",
        item.payment.amount,
        item.payment.method,
        item.payment.referenceNumber,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    ),
  );
  res.type("text/csv").send(rows.join("\n"));
}
