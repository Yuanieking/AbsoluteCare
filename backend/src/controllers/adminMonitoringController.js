import {
  completeAppointmentRecord,
  findAppointmentById,
  findPaidAppointments,
  findPayments,
  findSessions,
  getReportData,
  markAppointmentNoShow,
} from "../services/adminMonitoringService.js";
import {
  notifyAppointmentCompleted,
  notifyAppointmentNoShow,
} from "../services/notificationService.js";
import { guardFresh } from "../services/concurrencyService.js";
import { clinicDate, clinicDay } from "../utils/appointmentDates.js";

function dateFilter(query, field = "scheduledStart") {
  const filter = {};
  if (query.from) filter[field] = { $gte: clinicDate(query.from) };
  if (query.to) {
    filter[field] = {
      ...(query.from ? { $gte: clinicDate(query.from) } : {}),
      $lte: clinicDate(query.to, true),
    };
  }
  return filter;
}

function searchText(item, search) {
  if (!search) return true;
  const value =
    `${item.patient?.firstname || ""} ${item.patient?.lastname || ""} ${item.patient?.email || ""} ${item.patient?.phone || ""} ${item.therapist?.firstname || ""} ${item.therapist?.lastname || ""} ${item.service?.name || ""}`.toLowerCase();
  return value.includes(search.toLowerCase());
}

export async function completeAppointment(req, res) {
  const appointment = await findAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
  if (appointment.status !== "confirmed") {
    res.status(409).json({
      message: `Cannot complete an appointment with status "${appointment.status}".`,
    });
    return;
  }
  if (!appointment.scheduledStart || appointment.scheduledStart > new Date()) {
    res.status(409).json({
      message:
        "This appointment can be marked completed once its start time has passed.",
    });
    return;
  }
  await completeAppointmentRecord(appointment, req.user.userId);
  await notifyAppointmentCompleted(appointment);
  res.json({ appointment, message: "Appointment marked completed." });
}

export async function markNoShow(req, res) {
  const appointment = await findAppointmentById(String(req.params.id));
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  // ** Concurrency: reject if the appointment changed since the client read it.
  guardFresh(appointment, req.get("If-Match"));
  if (appointment.status !== "confirmed") {
    res.status(409).json({
      message: `Cannot mark an appointment with status "${appointment.status}" as no-show.`,
    });
    return;
  }
  if (!appointment.scheduledStart || appointment.scheduledStart > new Date()) {
    res.status(409).json({
      message:
        "This appointment can be marked no-show once its start time has passed.",
    });
    return;
  }
  await markAppointmentNoShow(appointment, req.user.userId);
  await notifyAppointmentNoShow(appointment);
  res.json({ appointment, message: "Appointment marked no-show." });
}

export async function listSessions(req, res) {
  const query = dateFilter(req.query, "sessionDate");
  if (typeof req.query.service === "string" && req.query.service)
    query.service = req.query.service;
  const sessions = await findSessions(query);
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().toLowerCase()
      : undefined;
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
    $or: [
      { status: { $in: ["confirmed", "completed"] } },
      { "payment.status": "paid" },
    ],
    ...dateFilter(req.query),
  };
  if (req.query.status === "paid") query["payment.status"] = "paid";
  if (req.query.status === "unpaid") query["payment.status"] = { $ne: "paid" };
  const appointments = await findPayments(query);
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  res.json({
    appointments: appointments.filter((item) => searchText(item, search)),
  });
}

function range(query) {
  const from = query.from
    ? clinicDate(query.from)
    : clinicDate(`${clinicDay().slice(0, 7)}-01`);
  const to = query.to ? clinicDate(query.to, true) : new Date();
  return { from, to };
}

export async function reports(req, res) {
  const { from, to } = range(req.query);
  const {
    patientCount,
    newPatients,
    completedPatients,
    appointments,
    sessions,
    therapistWorkload,
    payments,
    topTherapists,
    unpaid,
    trend,
  } = await getReportData(from, to);
  const totalAppointments = appointments.reduce(
    (total, item) => total + item.count,
    0,
  );
  const completed =
    appointments.find((item) => item._id === "completed")?.count || 0;
  const revenue = payments.reduce((total, item) => total + item.total, 0);
  res.json({
    range: { from, to },
    patients: {
      total: patientCount,
      new: newPatients,
      withSessions: completedPatients,
    },
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
    topTherapist: topTherapists[0] || null,
    trend,
  });
}

export async function exportPayments(req, res) {
  const appointments = await findPaidAppointments({
    ...dateFilter(req.query),
    "payment.status": "paid",
  });
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
