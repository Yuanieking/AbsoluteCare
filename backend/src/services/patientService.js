import Appointment from "../models/appointmentModel.js";
import Dependent from "../models/dependentModel.js";
import Notification from "../models/notificationModel.js";
import Session from "../models/sessionModel.js";
import TherapyService from "../models/therapyServiceModel.js";
import User from "../models/userModel.js";
import { defaultTherapyServices } from "../config/therapyServices.js";
import { assertNotStale, freshFilter } from "./concurrencyService.js";

const servicePopulation = {
  path: "service",
  select: "name description duration fee",
};
const therapistPopulation = {
  path: "therapist",
  select: "firstname lastname specialization profilePicture",
};

export async function listPublicServices() {
  await Promise.all(
    defaultTherapyServices.map((service) =>
      TherapyService.updateOne(
        { name: service.name },
        { $setOnInsert: service },
        { upsert: true },
      ),
    ),
  );
  return TherapyService.find({ isActive: true })
    .select("name description duration fee")
    .sort({ name: 1 });
}

export async function listDependentsWithNextAppointment(patientId) {
  const dependents = await Dependent.find({
    guardian: patientId,
    isActive: true,
  }).sort({ firstName: 1 });
  const data = await Promise.all(
    dependents.map(async (dependent) => {
      const nextAppointment = await Appointment.findOne({
        patient: patientId,
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
  return data;
}

export async function createDependent(patientId, parsed) {
  return Dependent.create({ ...parsed, guardian: patientId });
}

export async function findDependent(patientId, id) {
  return Dependent.findOne({
    _id: id,
    guardian: patientId,
    isActive: true,
  });
}

export async function listDependentAppointments(patientId, dependentId) {
  return Appointment.find({ patient: patientId, dependent: dependentId })
    .populate([servicePopulation, therapistPopulation])
    .sort({ scheduledStart: -1, createdAt: -1 });
}

export async function listDependentSessions(patientId, dependentId) {
  return Session.find({ patient: patientId, dependent: dependentId })
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
    .sort({ sessionDate: -1 });
}

export async function updateDependent(patientId, id, parsed, ifMatch) {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const dependent = await Dependent.findOneAndUpdate(
    {
      _id: id,
      guardian: patientId,
      isActive: true,
      ...freshFilter(ifMatch),
    },
    { $set: parsed },
    { new: true, runValidators: true },
  );
  if (!dependent)
    await assertNotStale(ifMatch, () => activeDependent(patientId, id));
  return dependent;
}

function activeDependent(patientId, id) {
  return Dependent.exists({
    _id: id,
    guardian: patientId,
    isActive: true,
  });
}

export async function deactivateDependent(patientId, id, ifMatch) {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const dependent = await Dependent.findOneAndUpdate(
    {
      _id: id,
      guardian: patientId,
      isActive: true,
      ...freshFilter(ifMatch),
    },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!dependent)
    await assertNotStale(ifMatch, () => activeDependent(patientId, id));
  return dependent;
}

export async function findService(id) {
  return TherapyService.findOne({
    _id: id,
    isActive: true,
  });
}

export async function findOwnedDependent(patientId, dependentId) {
  return Dependent.findOne({
    _id: dependentId,
    guardian: patientId,
    isActive: true,
  });
}

export async function createAppointment(input) {
  const appointment = await Appointment.create({
    patient: input.patientId,
    dependent: input.dependent || null,
    service: input.service._id,
    requestedDate: input.requestedDate,
    requestedTime: input.requestedTime,
    notes: input.notes,
    status: "pending",
    payment: { amount: input.service.fee },
    serviceSnapshot: {
      name: input.service.name,
      duration: input.service.duration,
      fee: input.service.fee,
      category: input.service.category || "",
    },
  });
  await appointment.populate([servicePopulation, therapistPopulation]);
  return appointment;
}

export async function findAdminIds() {
  return User.find({
    role: "admin",
    isActive: true,
    isArchived: false,
    removedAt: null,
  }).select("_id");
}

export async function listAppointments(patientId, options) {
  const now = new Date();
  const query = { patient: patientId };
  let sort = { scheduledStart: 1, requestedDate: 1 };

  if (options.status === "pending") {
    query.status = "pending";
    sort = { createdAt: -1 };
  } else if (options.status === "previous") {
    query.$or = [
      { status: { $in: ["completed", "cancelled", "no_show"] } },
      { status: "confirmed", scheduledStart: { $lt: now } },
    ];
    sort = { scheduledStart: -1, createdAt: -1 };
  } else {
    query.status = "confirmed";
    query.scheduledStart = { $gte: now };
  }

  const filter = query;
  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .populate([
        servicePopulation,
        therapistPopulation,
        {
          path: "dependent",
          select: "firstName lastName relationship dateOfBirth",
        },
      ])
      .sort(sort)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit),
    Appointment.countDocuments(filter),
  ]);
  return { appointments, total };
}

export async function findOwnAppointment(patientId, id) {
  return Appointment.findOne({
    _id: id,
    patient: patientId,
  }).populate([
    servicePopulation,
    therapistPopulation,
    {
      path: "dependent",
      select: "firstName lastName dateOfBirth relationship",
    },
  ]);
}

export async function saveAppointment(appointment) {
  await appointment.save();
}

export async function findAppointmentCalendarFields(id) {
  return Appointment.findById(id).select("googleEventId googleEventLink");
}

export async function listSessions(patientId) {
  return Session.find({ patient: patientId })
    .select(
      "sessionDate durationMinutes patientVisibleNotes appointment therapist service dependent",
    )
    .populate([servicePopulation, therapistPopulation])
    .sort({ sessionDate: -1 });
}

export async function findSession(patientId, id) {
  return Session.findOne({
    _id: id,
    patient: patientId,
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
}

export async function listNotifications(patientId, page, limit) {
  const [notifications, total] = await Promise.all([
    Notification.find({ user: patientId })
      .populate(
        "appointment",
        "status scheduledStart requestedDate requestedTime",
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments({ user: patientId }),
  ]);
  return { notifications, total };
}

export async function markNotificationRead(patientId, id, ifMatch) {
  // ** Concurrency: atomic compare-and-swap on updatedAt when If-Match is sent.
  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      user: patientId,
      ...freshFilter(ifMatch),
    },
    { isRead: true },
    { new: true },
  );
  if (!notification)
    await assertNotStale(ifMatch, () =>
      Notification.exists({
        _id: id,
        user: patientId,
      }),
    );
  return notification;
}

export async function markAllNotificationsRead(patientId) {
  await Notification.updateMany(
    { user: patientId, isRead: false },
    { isRead: true },
  );
}

export async function unreadNotificationCount(patientId) {
  return Notification.countDocuments({ user: patientId, isRead: false });
}
