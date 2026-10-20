import Appointment from "../models/appointmentModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import {
  isValidFutureDate,
  manilaDateTime,
} from "../utils/appointmentDates.js";
import { rescheduleRequestSchema } from "../schema/appointmentSchema.js";
import { syncConfirmedAppointment } from "../services/calendarService.js";
import { notify, notifyMany } from "../services/notificationService.js";

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
const therapistId = (req) => req.user.userId;
const ownAppointment = (req) => ({
  _id: req.params.id,
  therapist: therapistId(req),
});

function appointmentQuery(status) {
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

export async function getProfile(req, res) {
  const user = await User.findById(therapistId(req)).select("-password");
  if (!user)
    return res.status(404).json({ message: "Therapist profile not found." });
  res.json({ profile: user });
}

export async function updateProfile(req, res) {
  const allowed = [
    "firstname",
    "lastname",
    "phone",
    "profilePicture",
    "address",
  ];
  const updates = {};
  for (const key of allowed)
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  if (req.body.specialization !== undefined || req.body.role !== undefined)
    return res.status(400).json({
      message:
        "Specialization and role are managed by the clinic administrator.",
    });
  const user = await User.findByIdAndUpdate(therapistId(req), updates, {
    new: true,
    runValidators: true,
  }).select("-password");
  res.json({ profile: user });
}

export async function updateAvailability(req, res) {
  const { workingDays, workingHours } = req.body;
  const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (
    !Array.isArray(workingDays) ||
    workingDays.some((day) => !validDays.includes(day))
  )
    return res.status(400).json({ message: "Choose valid working days." });
  if (
    !workingHours?.start ||
    !workingHours?.end ||
    workingHours.start >= workingHours.end
  )
    return res.status(400).json({
      message: "Working hours must have an end time after the start time.",
    });
  const profile = await User.findByIdAndUpdate(
    therapistId(req),
    { workingDays, workingHours },
    { new: true },
  ).select("workingDays workingHours");
  res.json({ profile });
}

export async function listAppointments(req, res) {
  const query = {
    therapist: therapistId(req),
    ...appointmentQuery(req.query.status),
  };
  const appointments = await Appointment.find(query)
    .populate([servicePopulation, patientPopulation, dependentPopulation])
    .sort({ scheduledStart: req.query.status === "previous" ? -1 : 1 });
  res.json({ appointments });
}

export async function getAppointment(req, res) {
  const appointment = await Appointment.findOne(ownAppointment(req)).populate([
    servicePopulation,
    patientPopulation,
    dependentPopulation,
  ]);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  res.json({ appointment });
}

export async function listPatients(req, res) {
  const appointments = await Appointment.find({ therapist: therapistId(req) })
    .populate("dependent", "firstName lastName relationship")
    .select("patient dependent scheduledStart status")
    .sort({ scheduledStart: 1 });
  const patientIds = [
    ...new Set(appointments.map((item) => item.patient.toString())),
  ];
  const sessions = await Session.find({ therapist: therapistId(req) })
    .select("patient sessionDate")
    .sort({ sessionDate: -1 });
  const users = await User.find({ _id: { $in: patientIds } }).select(
    "firstname lastname email phone profilePicture",
  );
  const patients = users.map((patient) => {
    const items = appointments.filter(
      (item) => item.patient.toString() === patient._id.toString(),
    );
    const next = items.find(
      (item) =>
        item.status === "confirmed" && item.scheduledStart >= new Date(),
    );
    const lastSession = sessions.find(
      (item) => item.patient.toString() === patient._id.toString(),
    );
    const dependentAppointment = items.find((item) => item.dependent);
    return {
      patient,
      dependent: dependentAppointment?.dependent || null,
      nextAppointment: next || null,
      lastSessionDate: lastSession?.sessionDate || null,
    };
  });
  res.json({ patients });
}

export async function requestReschedule(req, res) {
  const parsed = rescheduleRequestSchema.parse(req.body);
  const appointment = await Appointment.findOne(ownAppointment(req));
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  const currentStart =
    appointment.scheduledStart ||
    manilaDateTime(appointment.requestedDate, appointment.requestedTime);
  if (
    !["pending", "confirmed"].includes(appointment.status) ||
    currentStart <= new Date() ||
    !isValidFutureDate(parsed.proposedDate, parsed.proposedTime)
  )
    return res.status(400).json({
      message: "Choose a future date and time for an active appointment.",
    });
  appointment.rescheduleRequest = {
    ...parsed,
    status: "requested",
    requestedBy: "therapist",
    requestedAt: new Date(),
  };
  await appointment.save();
  const admins = await User.find({
    role: "admin",
    isActive: true,
    isArchived: false,
    removedAt: null,
  }).select("_id");
  await notifyMany(
    admins.map((admin) => admin._id),
    {
      type: "reschedule_requested",
      title: "Therapist reschedule request",
      message: `A therapist requested a new time for an appointment on ${parsed.proposedDate} at ${parsed.proposedTime}.`,
      appointment: appointment._id,
      dependent: appointment.dependent,
      link: `/staff/admin/appointments/${appointment._id}`,
      actorId: therapistId(req),
    },
  );
  await notify({
    user: appointment.patient,
    appointment: appointment._id,
    type: "reschedule_requested",
    title: "Reschedule request",
    message: "Your therapist requested a new appointment time.",
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
    actorId: therapistId(req),
  });
  res.json({ appointment });
}

export async function markNoShow(req, res) {
  const appointment = await Appointment.findOne(ownAppointment(req));
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (
    appointment.status !== "confirmed" ||
    !appointment.scheduledStart ||
    appointment.scheduledStart > new Date()
  )
    return res.status(400).json({
      message:
        "A confirmed appointment can be marked no-show only after its scheduled time.",
    });
  appointment.status = "no_show";
  appointment.noShowMarkedBy = therapistId(req);
  appointment.noShowMarkedAt = new Date();
  await appointment.save();
  await notify({
    user: appointment.patient,
    type: "appointment_no_show",
    title: "Appointment marked no-show",
    message:
      "Your appointment was marked as a no-show. Contact the clinic if this is incorrect.",
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
    actorId: therapistId(req),
  });
  res.json({ appointment });
}

export async function createSession(req, res) {
  const appointment = await Appointment.findOne(ownAppointment(req)).populate(
    "service",
  );
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (
    appointment.status !== "confirmed" ||
    !appointment.scheduledStart ||
    appointment.scheduledStart > new Date()
  )
    return res.status(400).json({
      message:
        "Sessions can be recorded after a confirmed appointment has passed.",
    });
  const sessionDate = new Date(req.body.sessionDate);
  const durationMinutes = Number(req.body.durationMinutes);
  if (
    Number.isNaN(sessionDate.getTime()) ||
    sessionDate > new Date() ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1
  )
    return res
      .status(400)
      .json({ message: "Enter a valid past date and duration." });
  const session = await Session.create({
    appointment: appointment._id,
    patient: appointment.patient,
    dependent: appointment.dependent || null,
    therapist: therapistId(req),
    service: appointment.service._id,
    sessionDate,
    durationMinutes,
    clinicalNotes: req.body.notes?.trim() || "",
  });
  appointment.status = "completed";
  await appointment.save();
  await notify({
    user: appointment.patient,
    type: "session_recorded",
    title: "Session recorded",
    message: "Your therapy session has been recorded in your patient portal.",
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/dashboard/appointments/${appointment._id}`,
    actorId: therapistId(req),
  });
  res.status(201).json({ session });
}

export async function listSessions(req, res) {
  const query = { therapist: therapistId(req) };
  if (req.query.patient) query.patient = req.query.patient;
  if (req.query.appointment) query.appointment = req.query.appointment;
  const sessions = await Session.find(query)
    .populate([servicePopulation, patientPopulation, dependentPopulation])
    .sort({ sessionDate: -1 });
  res.json({ sessions });
}

export async function getSession(req, res) {
  const session = await Session.findOne({
    _id: req.params.id,
    therapist: therapistId(req),
  }).populate([servicePopulation, patientPopulation, dependentPopulation]);
  if (!session) return res.status(404).json({ message: "Session not found." });
  res.json({ session });
}

export async function updateSession(req, res) {
  const session = await Session.findOne({
    _id: req.params.id,
    therapist: therapistId(req),
  });
  if (!session) return res.status(404).json({ message: "Session not found." });
  if (req.body.sessionDate !== undefined)
    session.sessionDate = new Date(req.body.sessionDate);
  if (req.body.durationMinutes !== undefined)
    session.durationMinutes = Number(req.body.durationMinutes);
  if (req.body.notes !== undefined)
    session.clinicalNotes = req.body.notes.trim();
  session.editedAt = new Date();
  session.editHistory.push({
    editedBy: therapistId(req),
    editedAt: session.editedAt,
  });
  await session.save();
  res.json({ session });
}

export async function calendarStatus(req, res) {
  const user = await User.findById(therapistId(req)).select("googleCalendar");
  res.json({
    connected: Boolean(user.googleCalendar?.connected),
    email: user.googleCalendar?.email || "",
  });
}

export async function syncCalendarAppointment(req, res) {
  const appointment = await Appointment.findOne(ownAppointment(req));
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  await syncConfirmedAppointment(appointment._id, therapistId(req));
  res.json({ message: "Calendar sync requested." });
}
