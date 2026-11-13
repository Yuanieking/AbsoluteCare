import { Types } from "mongoose";
import Appointment from "../models/appointmentModel.js";
import User from "../models/userModel.js";
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

function dateRange(filters) {
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

function scheduleQuery(filters) {
  const status = filters.status || "confirmed";
  const query = status === "all" ? {} : { status };
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

export async function getProfile(userId) {
  const user = await User.findById(userId).select("-password -accountAudit");
  // mongoose 9 drops instance-method typing on .select(); the doc has them.
  return user;
}

export async function updateProfile(userId, updates, ifMatch) {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const user = await User.findOneAndUpdate(
    { _id: userId, ...freshFilter(ifMatch) },
    {
      $set: updates,
      $push: { accountAudit: { action: "profile_updated", by: userId } },
    },
    { new: true, runValidators: true },
  ).select("-password -accountAudit");
  if (!user) await assertNotStale(ifMatch, () => User.exists({ _id: userId }));
  return user;
}

export async function searchTherapists() {
  return User.find({
    role: "therapist",
    isActive: true,
  })
    .select("firstname lastname")
    .sort({ lastname: 1, firstname: 1 });
}

export async function listSchedule(filters) {
  const appointments = await Appointment.find(scheduleQuery(filters))
    .populate(appointmentPopulate)
    .sort({ scheduledStart: 1, requestedDate: 1 });
  // populate() replaces the refs with documents at runtime; the schema types them as ids.
  return appointments;
}

export async function getAppointmentForPayment(appointmentId) {
  const appointment =
    await Appointment.findById(appointmentId).populate(appointmentPopulate);
  return appointment;
}

export async function listPaymentAppointments(status) {
  const query = {
    status: { $in: ["confirmed", "completed"] },
  };
  if (status === "paid") query["payment.status"] = "paid";
  if (status === "unpaid")
    query.$or = [
      { "payment.status": "unpaid" },
      { payment: { $exists: false } },
    ];
  const appointments = await Appointment.find(query)
    .populate(appointmentPopulate)
    .sort({ scheduledStart: 1 });
  return appointments;
}

export async function applyPaidPayment(appointment, payment, audit) {
  appointment.payment = {
    ...payment,
    method: payment.method,
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

export async function applyUnpaidPayment(appointment, reason, audit) {
  appointment.payment = appointment.payment || {};
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
