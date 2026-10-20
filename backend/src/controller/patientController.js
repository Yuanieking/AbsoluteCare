import Appointment from "../models/appointmentModel.js";
import Dependent from "../models/dependentModel.js";
import Notification from "../models/notificationModel.js";
import Session from "../models/sessionModel.js";
import TherapyService from "../models/therapyServiceModel.js";
import User from "../models/userModel.js";
import {
  appointmentRequestSchema,
  rescheduleRequestSchema,
} from "../schema/appointmentSchema.js";
import {
  isValidFutureDate,
  manilaDateTime,
} from "../utils/appointmentDates.js";
import {
  dependentSchema,
  dependentUpdateSchema,
} from "../schema/dependentSchema.js";
import { syncConfirmedAppointment } from "../services/calendarService.js";
import { defaultTherapyServices } from "../config/therapyServices.js";
import { notify, notifyMany } from "../services/notificationService.js";

const servicePopulation = {
  path: "service",
  select: "name description duration fee",
};
const therapistPopulation = {
  path: "therapist",
  select: "firstname lastname specialization profilePicture",
};

function ownAppointmentQuery(req) {
  return { _id: req.params.id, patient: req.patient._id };
}

function publicAppointment(appointment) {
  return appointment;
}

export async function listServices(req, res) {
  await Promise.all(
    defaultTherapyServices.map((service) =>
      TherapyService.updateOne(
        { name: service.name },
        { $setOnInsert: service },
        { upsert: true },
      ),
    ),
  );
  const services = await TherapyService.find({ isActive: true })
    .select("name description duration fee")
    .sort({ name: 1 });
  res.json({ services });
}

export async function listDependents(req, res) {
  const dependents = await Dependent.find({
    guardian: req.patient._id,
    isActive: true,
  }).sort({ firstName: 1 });
  const data = await Promise.all(
    dependents.map(async (dependent) => {
      const nextAppointment = await Appointment.findOne({
        patient: req.patient._id,
        dependent: dependent._id,
        status: "confirmed",
        scheduledStart: { $gte: new Date() },
      })
        .select(
          "scheduledStart scheduledEnd requestedDate requestedTime service",
        )
        .populate(servicePopulation)
        .sort({ scheduledStart: 1 });
      return { ...dependent.toObject(), nextAppointment };
    }),
  );
  res.json({ dependents: data });
}

export async function createDependent(req, res) {
  const parsed = dependentSchema.parse(req.body);
  const dependent = await Dependent.create({
    ...parsed,
    guardian: req.patient._id,
  });
  res.status(201).json({ dependent });
}

export async function getDependent(req, res) {
  const dependent = await Dependent.findOne({
    _id: req.params.id,
    guardian: req.patient._id,
    isActive: true,
  });
  if (!dependent)
    return res.status(404).json({ message: "Dependent not found." });

  const [appointments, sessions] = await Promise.all([
    Appointment.find({ patient: req.patient._id, dependent: dependent._id })
      .populate([servicePopulation, therapistPopulation])
      .sort({ scheduledStart: -1, createdAt: -1 }),
    Session.find({ patient: req.patient._id, dependent: dependent._id })
      .select(
        "sessionDate durationMinutes patientVisibleNotes appointment therapist service",
      )
      .populate([
        servicePopulation,
        therapistPopulation,
        {
          path: "dependent",
          select: "firstName lastName relationship dateOfBirth",
        },
      ])
      .sort({ sessionDate: -1 }),
  ]);
  res.json({ dependent, appointments, sessions });
}

export async function updateDependent(req, res) {
  const parsed = dependentUpdateSchema.parse(req.body);
  const dependent = await Dependent.findOneAndUpdate(
    { _id: req.params.id, guardian: req.patient._id, isActive: true },
    { $set: parsed },
    { new: true, runValidators: true },
  );
  if (!dependent)
    return res.status(404).json({ message: "Dependent not found." });
  res.json({ dependent });
}

export async function removeDependent(req, res) {
  const dependent = await Dependent.findOneAndUpdate(
    { _id: req.params.id, guardian: req.patient._id, isActive: true },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!dependent)
    return res.status(404).json({ message: "Dependent not found." });
  res.json({ message: "Dependent removed." });
}

export async function requestAppointment(req, res) {
  const parsed = appointmentRequestSchema.parse(req.body);
  const service = await TherapyService.findOne({
    _id: parsed.service,
    isActive: true,
  });
  if (!service)
    return res
      .status(400)
      .json({ message: "That therapy service is not available." });
  if (!isValidFutureDate(parsed.requestedDate, parsed.requestedTime)) {
    return res.status(400).json({ message: "Choose a future date and time." });
  }

  if (parsed.dependent) {
    const dependent = await Dependent.findOne({
      _id: parsed.dependent,
      guardian: req.patient._id,
      isActive: true,
    });
    if (!dependent)
      return res
        .status(400)
        .json({ message: "That dependent is not available." });
  }

  const appointment = await Appointment.create({
    patient: req.patient._id,
    dependent: parsed.dependent || null,
    service: service._id,
    requestedDate: parsed.requestedDate,
    requestedTime: parsed.requestedTime,
    notes: parsed.notes,
    status: "pending",
    serviceSnapshot: {
      name: service.name,
      duration: service.duration,
      fee: service.fee,
      category: service.category || "",
    },
  });

  await appointment.populate([servicePopulation, therapistPopulation]);
  const admins = await User.find({
    role: "admin",
    isActive: true,
    isArchived: false,
    removedAt: null,
  }).select("_id");
  await notifyMany(
    admins.map((admin) => admin._id),
    {
      type: "appointment_requested",
      title: "New appointment request",
      message: `${req.patient.firstname} ${req.patient.lastname} requested ${service.name}.`,
      appointment: appointment._id,
      dependent: appointment.dependent,
      link: `/staff/admin/appointments/${appointment._id}`,
      actorId: req.patient._id,
    },
  );
  res.status(201).json({ appointment });
}

export async function listAppointments(req, res) {
  const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit || "10", 10), 1),
    50,
  );
  const now = new Date();
  const status = req.query.status || "upcoming";
  let query = { patient: req.patient._id };
  let sort = { scheduledStart: 1, requestedDate: 1 };

  if (status === "pending") {
    query.status = "pending";
    sort = { createdAt: -1 };
  } else if (status === "previous") {
    query.$or = [
      { status: { $in: ["completed", "cancelled", "no_show"] } },
      { status: "confirmed", scheduledStart: { $lt: now } },
    ];
    sort = { scheduledStart: -1, createdAt: -1 };
  } else {
    query.status = "confirmed";
    query.scheduledStart = { $gte: now };
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate([
        servicePopulation,
        therapistPopulation,
        {
          path: "dependent",
          select: "firstName lastName relationship dateOfBirth",
        },
      ])
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Appointment.countDocuments(query),
  ]);

  res.json({
    appointments: appointments.map(publicAppointment),
    page,
    limit,
    total,
  });
}

export async function getAppointment(req, res) {
  const appointment = await Appointment.findOne(
    ownAppointmentQuery(req),
  ).populate([
    servicePopulation,
    therapistPopulation,
    {
      path: "dependent",
      select: "firstName lastName dateOfBirth relationship",
    },
  ]);
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  res.json({ appointment });
}

export async function requestReschedule(req, res) {
  const parsed = rescheduleRequestSchema.parse(req.body);
  const appointment = await Appointment.findOne(ownAppointmentQuery(req));
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (!["pending", "confirmed"].includes(appointment.status)) {
    return res
      .status(400)
      .json({ message: "This appointment can no longer be rescheduled." });
  }
  const currentStart =
    appointment.scheduledStart ||
    manilaDateTime(appointment.requestedDate, appointment.requestedTime);
  if (
    currentStart <= new Date() ||
    !isValidFutureDate(parsed.proposedDate, parsed.proposedTime)
  ) {
    return res
      .status(400)
      .json({ message: "Choose a future reschedule date and time." });
  }
  if (appointment.rescheduleRequest?.status === "requested") {
    return res
      .status(409)
      .json({ message: "A reschedule request is already open." });
  }

  appointment.rescheduleRequest = {
    status: "requested",
    proposedDate: parsed.proposedDate,
    proposedTime: parsed.proposedTime,
    reason: parsed.reason,
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
      title: "Reschedule request",
      message: `A patient requested a new time for an appointment on ${parsed.proposedDate} at ${parsed.proposedTime}.`,
      appointment: appointment._id,
      dependent: appointment.dependent,
      link: `/staff/admin/appointments/${appointment._id}`,
      actorId: req.patient._id,
    },
  );
  res.json({ appointment });
}

export async function cancelAppointment(req, res) {
  const appointment = await Appointment.findOne(ownAppointmentQuery(req));
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  const start =
    appointment.scheduledStart ||
    manilaDateTime(appointment.requestedDate, appointment.requestedTime);
  if (
    !["pending", "confirmed"].includes(appointment.status) ||
    start - new Date() < 24 * 60 * 60 * 1000
  ) {
    return res.status(400).json({
      message:
        "This appointment cannot be cancelled within 24 hours of the visit.",
    });
  }
  appointment.status = "cancelled";
  appointment.cancelReason = req.body?.reason?.trim() || "Cancelled by patient";
  appointment.cancelledBy = req.patient._id;
  await appointment.save();
  if (appointment.therapist) {
    await notify({
      user: appointment.therapist,
      type: "appointment_cancelled",
      title: "Appointment cancelled",
      message: `An appointment was cancelled: ${appointment.cancelReason}`,
      appointment: appointment._id,
      dependent: appointment.dependent,
      link: `/staff/therapist/appointments/${appointment._id}`,
      actorId: req.patient._id,
    });
  }
  res.json({ appointment });
}

export async function syncAppointmentCalendar(req, res) {
  const appointment = await Appointment.findOne(ownAppointmentQuery(req));
  if (!appointment)
    return res.status(404).json({ message: "Appointment not found." });
  if (appointment.status !== "confirmed") {
    return res.status(400).json({
      message: "Only confirmed appointments can be added to Google Calendar.",
    });
  }

  try {
    await syncConfirmedAppointment(appointment._id);
    const refreshed = await Appointment.findById(appointment._id).select(
      "googleEventId googleEventLink",
    );
    res.json({
      googleEventId: refreshed.googleEventId,
      googleEventLink: refreshed.googleEventLink,
    });
  } catch (error) {
    res
      .status(502)
      .json({ message: error.message || "Google Calendar is unavailable." });
  }
}

export async function listSessions(req, res) {
  const sessions = await Session.find({ patient: req.patient._id })
    .select(
      "sessionDate durationMinutes patientVisibleNotes appointment therapist service dependent",
    )
    .populate([servicePopulation, therapistPopulation])
    .sort({ sessionDate: -1 });
  res.json({ sessions });
}

export async function getSession(req, res) {
  const session = await Session.findOne({
    _id: req.params.id,
    patient: req.patient._id,
  })
    .select(
      "sessionDate durationMinutes patientVisibleNotes appointment therapist service",
    )
    .populate([
      servicePopulation,
      therapistPopulation,
      {
        path: "dependent",
        select: "firstName lastName relationship dateOfBirth",
      },
    ]);
  if (!session) return res.status(404).json({ message: "Session not found." });
  res.json({ session });
}

export async function listNotifications(req, res) {
  const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit || "20", 10), 1),
    50,
  );
  const [notifications, total] = await Promise.all([
    Notification.find({ user: req.patient._id })
      .populate(
        "appointment",
        "status scheduledStart requestedDate requestedTime",
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments({ user: req.patient._id }),
  ]);
  res.json({ notifications, page, limit, total });
}

export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.patient._id },
    { isRead: true },
    { new: true },
  );
  if (!notification)
    return res.status(404).json({ message: "Notification not found." });
  res.json({ notification });
}

export async function markAllNotificationsRead(req, res) {
  await Notification.updateMany(
    { user: req.patient._id, isRead: false },
    { isRead: true },
  );
  res.status(204).send();
}

export async function unreadNotificationCount(req, res) {
  const count = await Notification.countDocuments({
    user: req.patient._id,
    isRead: false,
  });
  res.json({ count });
}
