import { notify } from "../services/notificationService.js";
import * as secretaryService from "../services/secretaryService.js";
import { guardFresh } from "../services/concurrencyService.js";

const ownId = (req) => req.user.userId;

function paymentValue(appointment) {
  return appointment.payment?.amount || appointment.service?.fee || 0;
}

function personName(person) {
  const value = person;
  if (!value || typeof value !== "object") return "";
  return `${value.firstname || ""} ${value.lastname || ""}`.trim();
}

function publicAppointment(appointment) {
  const value = appointment.toObject();
  value.payment = {
    status: appointment.payment?.status || "unpaid",
    amount: paymentValue(appointment),
    method: appointment.payment?.method || "cash",
    referenceNumber: appointment.payment?.referenceNumber || "",
    recordedBy: personName(appointment.payment?.recordedBy) || null,
    recordedAt: appointment.payment?.recordedAt || null,
    notes: appointment.payment?.notes || "",
    history: appointment.paymentAudit.map((entry) => ({
      action: entry.action,
      by: personName(entry.by) || null,
      details: entry.details,
      at: entry.at || null,
    })),
  };
  delete value.auditLog;
  delete value.paymentAudit;
  return value;
}

function matchesSearch(appointment, search) {
  if (!search) return true;
  const text =
    `${appointment.patient?.firstname || ""} ${appointment.patient?.lastname || ""} ${appointment.patient?.email || ""} ${appointment.therapist?.firstname || ""} ${appointment.therapist?.lastname || ""}`.toLowerCase();
  return text.includes(search.toLowerCase());
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

export async function getProfile(req, res) {
  const user = await secretaryService.getProfile(ownId(req));
  if (!user) {
    res.status(404).json({ message: "Secretary profile not found." });
    return;
  }
  res.json({ profile: user });
}

export async function updateProfile(req, res) {
  const allowed = ["firstname", "lastname", "phone", "profilePicture"];
  if (req.body.role !== undefined || req.body.email !== undefined) {
    res.status(400).json({ message: "Role and email cannot be changed here." });
    return;
  }
  const updates = Object.fromEntries(
    allowed
      .filter((key) => req.body[key] !== undefined)
      .map((key) => [key, req.body[key]]),
  );
  const user = await secretaryService.updateProfile(
    ownId(req),
    updates,
    req.get("If-Match"),
  );
  if (!user) {
    res.status(404).json({ message: "Secretary profile not found." });
    return;
  }
  res.json({ profile: user });
}

export async function listSchedule(req, res) {
  const appointments = await secretaryService.listSchedule({
    status: req.query.status,
    therapist: req.query.therapist,
    date: req.query.date,
    from: req.query.from,
    to: req.query.to,
  });
  const search = req.query.search?.trim();
  const therapists = await secretaryService.searchTherapists();
  res.json({
    appointments: appointments
      .filter((appointment) => matchesSearch(appointment, search))
      .map(publicAppointment),
    therapists,
  });
}

export async function getAppointmentDetails(req, res) {
  const appointment = await secretaryService.getAppointmentForPayment(
    String(req.params.id),
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  res.json({ appointment: publicAppointment(appointment) });
}

export async function listPayments(req, res) {
  const appointments = await secretaryService.listPaymentAppointments(
    req.query.status,
  );
  const search = req.query.search?.trim();
  res.json({
    appointments: appointments
      .filter((appointment) => matchesSearch(appointment, search))
      .map(publicAppointment),
  });
}

export async function recordPayment(req, res) {
  const appointment = await secretaryService.getAppointmentForPayment(
    String(req.params.id),
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  if (!["confirmed", "completed"].includes(appointment.status)) {
    res.status(409).json({
      message:
        "Payments can only be recorded for confirmed or completed appointments.",
    });
    return;
  }
  const parsed = parsePayment(req.body, appointment);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }
  await secretaryService.applyPaidPayment(appointment, parsed, {
    action: "recorded",
    by: req.user.userId,
    details: `${parsed.amount} via ${parsed.method}`,
  });
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
  const appointment = await secretaryService.getAppointmentForPayment(
    String(req.params.id),
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
  const status = req.body.status || "paid";
  if (!["paid", "unpaid"].includes(status)) {
    res.status(400).json({ message: "Choose a valid payment status." });
    return;
  }
  if (status === "unpaid" && !req.body.reason?.trim()) {
    res
      .status(400)
      .json({ message: "A reason is required when marking payment unpaid." });
    return;
  }
  if (status === "paid") {
    const parsed = parsePayment(req.body, appointment);
    if ("error" in parsed) {
      res.status(400).json({ message: parsed.error });
      return;
    }
    await secretaryService.applyPaidPayment(appointment, parsed, {
      action: "updated",
      by: req.user.userId,
      details: req.body.reason?.trim() || "Payment details updated.",
    });
  } else {
    await secretaryService.applyUnpaidPayment(
      appointment,
      req.body.reason.trim(),
      {
        action: "marked_unpaid",
        by: req.user.userId,
        details: req.body.reason.trim(),
      },
    );
  }
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
