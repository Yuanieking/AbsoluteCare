import User from "../models/userModel.js";
import Appointment from "../models/appointmentModel.js";
import { notify } from "../services/notificationService.js";

const appointmentPopulate = [
  { path: "patient", select: "firstname lastname email phone profilePicture" },
  { path: "dependent", select: "firstName lastName dateOfBirth relationship" },
  {
    path: "therapist",
    select: "firstname lastname specialization profilePicture",
  },
  { path: "service", select: "name description duration fee" },
];

function paymentValue(appointment) {
  return appointment.payment?.amount || appointment.service?.fee || 0;
}

function publicAppointment(appointment) {
  const value = appointment.toObject();
  value.payment = {
    status: appointment.payment?.status || "unpaid",
    amount: paymentValue(appointment),
    method: appointment.payment?.method || "cash",
    referenceNumber: appointment.payment?.referenceNumber || "",
    recordedBy: appointment.payment?.recordedBy || null,
    recordedAt: appointment.payment?.recordedAt || null,
    notes: appointment.payment?.notes || "",
  };
  delete value.auditLog;
  delete value.paymentAudit;
  return value;
}

function dateRange(query) {
  const today = new Date();
  if (query.date === "today") {
    const value = today.toLocaleDateString("en-CA", {
      timeZone: "Asia/Manila",
    });
    return [`${value}T00:00:00+08:00`, `${value}T23:59:59+08:00`];
  }
  if (query.date === "week") {
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
  return [query.from, query.to];
}

function appointmentQuery(req) {
  const status = req.query.status || "confirmed";
  const query = status === "all" ? {} : { status };
  if (!req.query.status) query.scheduledStart = { $gte: new Date() };
  if (req.query.therapist) query.therapist = req.query.therapist;
  const [from, to] = dateRange(req.query);
  if (from || to)
    query.scheduledStart = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  return query;
}

function matchesSearch(appointment, search) {
  if (!search) return true;
  const text =
    `${appointment.patient?.firstname || ""} ${appointment.patient?.lastname || ""} ${appointment.patient?.email || ""} ${appointment.therapist?.firstname || ""} ${appointment.therapist?.lastname || ""}`.toLowerCase();
  return text.includes(search.toLowerCase());
}

const ownId = (req) => req.user.userId;

export async function getProfile(req, res) {
  const user = await User.findById(ownId(req)).select(
    "-password -accountAudit",
  );
  if (!user)
    return res.status(404).json({ message: "Secretary profile not found." });
  res.json({ profile: user });
}

export async function updateProfile(req, res) {
  const allowed = ["firstname", "lastname", "phone", "profilePicture"];
  if (req.body.role !== undefined || req.body.email !== undefined) {
    return res
      .status(400)
      .json({ message: "Role and email cannot be changed here." });
  }
  const updates = Object.fromEntries(
    allowed
      .filter((key) => req.body[key] !== undefined)
      .map((key) => [key, req.body[key]]),
  );
  const user = await User.findByIdAndUpdate(
    ownId(req),
    {
      $set: updates,
      $push: { accountAudit: { action: "profile_updated", by: ownId(req) } },
    },
    { new: true, runValidators: true },
  ).select("-password -accountAudit");
  if (!user)
    return res.status(404).json({ message: "Secretary profile not found." });
  res.json({ profile: user });
}

export async function listSchedule(req, res) {
  const appointments = await Appointment.find(appointmentQuery(req))
    .populate(appointmentPopulate)
    .sort({ scheduledStart: 1, requestedDate: 1 });
  const search = req.query.search?.trim();
  const therapists = await User.find({ role: "therapist", isActive: true })
    .select("firstname lastname")
    .sort({ lastname: 1, firstname: 1 });
  res.json({
    appointments: appointments
      .filter((appointment) => matchesSearch(appointment, search))
      .map(publicAppointment),
    therapists,
  });
}

export async function getAppointmentDetails(req, res) {
  const appointment = await Appointment.findById(req.params.id).populate(
    appointmentPopulate,
  );
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  res.json({ appointment: publicAppointment(appointment) });
}

export async function listPayments(req, res) {
  const query = { status: { $in: ["confirmed", "completed"] } };
  if (req.query.status === "paid") query["payment.status"] = "paid";
  if (req.query.status === "unpaid")
    query["$or"] = [
      { "payment.status": "unpaid" },
      { payment: { $exists: false } },
    ];
  const appointments = await Appointment.find(query)
    .populate(appointmentPopulate)
    .sort({ scheduledStart: 1 });
  const search = req.query.search?.trim();
  res.json({
    appointments: appointments
      .filter((appointment) => matchesSearch(appointment, search))
      .map(publicAppointment),
  });
}

function parsePayment(body, appointment) {
  const amount = Number(body.amount ?? paymentValue(appointment));
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Payment amount must be greater than zero." };
  const method = body.method || "cash";
  if (!["cash", "gcash", "card", "other"].includes(method))
    return { error: "Choose a valid payment method." };
  if (method !== "cash" && !body.referenceNumber?.trim())
    return { error: "A reference number is required for this payment method." };
  return {
    amount,
    method,
    referenceNumber: body.referenceNumber?.trim() || "",
    notes: body.notes?.trim() || "",
  };
}

export async function recordPayment(req, res) {
  const appointment = await Appointment.findById(req.params.id).populate(
    appointmentPopulate,
  );
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (!["confirmed", "completed"].includes(appointment.status))
    return res.status(409).json({
      message:
        "Payments can only be recorded for confirmed or completed appointments.",
    });
  const parsed = parsePayment(req.body, appointment);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  appointment.payment = {
    ...parsed,
    status: "paid",
    recordedBy: req.user.userId,
    recordedAt: new Date(),
  };
  appointment.paymentAudit.push({
    action: "recorded",
    by: req.user.userId,
    details: `${parsed.amount} via ${parsed.method}`,
  });
  await appointment.save();
  await notify({
    user: appointment.patient,
    type: "payment_recorded",
    title: "Payment recorded",
    message: "A payment for your AbsoluteCare appointment was recorded.",
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
    actorId: req.user.userId,
  });
  res.json({
    appointment: publicAppointment(appointment),
    message: "Payment recorded.",
  });
}

export async function updatePayment(req, res) {
  const appointment = await Appointment.findById(req.params.id).populate(
    appointmentPopulate,
  );
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  const status = req.body.status || "paid";
  if (!["paid", "unpaid"].includes(status))
    return res.status(400).json({ message: "Choose a valid payment status." });
  if (status === "unpaid" && !req.body.reason?.trim())
    return res
      .status(400)
      .json({ message: "A reason is required when marking payment unpaid." });
  if (status === "paid") {
    const parsed = parsePayment(req.body, appointment);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    appointment.payment = {
      ...parsed,
      status,
      recordedBy: req.user.userId,
      recordedAt: new Date(),
    };
  } else {
    appointment.payment = appointment.payment || {};
    appointment.payment.status = "unpaid";
    appointment.payment.notes = req.body.reason.trim();
  }
  appointment.paymentAudit.push({
    action: status === "paid" ? "updated" : "marked_unpaid",
    by: req.user.userId,
    details: req.body.reason?.trim() || "Payment details updated.",
  });
  await appointment.save();
  if (status === "paid") {
    await notify({
      user: appointment.patient,
      type: "payment_recorded",
      title: "Payment updated",
      message: "Your appointment payment details were updated.",
      appointment: appointment._id,
      dependent: appointment.dependent,
      link: `/dashboard/appointments/${appointment._id}`,
      actorId: req.user.userId,
    });
  }
  res.json({
    appointment: publicAppointment(appointment),
    message: "Payment status updated.",
  });
}
