import type { QueryFilter, Types } from "mongoose";
import Appointment, {
  type Appointment as AppointmentData,
  type AppointmentDoc,
} from "../models/appointmentModel.js";
import Dependent, {
  type Dependent as DependentData,
  type DependentDoc,
} from "../models/dependentModel.js";
import Notification, {
  type Notification as NotificationData,
} from "../models/notificationModel.js";
import Session, {
  type Session as SessionData,
} from "../models/sessionModel.js";
import TherapyService, {
  type TherapyService as TherapyServiceData,
  type TherapyServiceDoc,
} from "../models/therapyServiceModel.js";
import User, { type UserDoc } from "../models/userModel.js";
import { defaultTherapyServices } from "../config/therapyServices.js";
import type {
  DependentInput,
  DependentUpdateInput,
} from "../schemas/dependentSchema.js";

const servicePopulation = {
  path: "service",
  select: "name description duration fee",
};
const therapistPopulation = {
  path: "therapist",
  select: "firstname lastname specialization profilePicture",
};

export async function listPublicServices(): Promise<TherapyServiceDoc[]> {
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

export async function listDependentsWithNextAppointment(
  patientId: Types.ObjectId,
): Promise<Array<Record<string, unknown>>> {
  const dependents = await Dependent.find({
    guardian: patientId,
    isActive: true,
  }).sort({ firstName: 1 });
  const data: Array<Record<string, unknown>> = await Promise.all(
    dependents.map(async (dependent) => {
      const nextAppointment = await Appointment.findOne({
        patient: patientId,
        dependent: dependent._id,
        status: "confirmed",
        scheduledStart: { $gte: new Date() },
      } as unknown as QueryFilter<AppointmentData>)
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

export async function createDependent(
  patientId: Types.ObjectId,
  parsed: DependentInput,
): Promise<DependentDoc> {
  return Dependent.create({ ...parsed, guardian: patientId });
}

export async function findDependent(
  patientId: Types.ObjectId,
  id: string,
): Promise<DependentDoc | null> {
  return Dependent.findOne({
    _id: id,
    guardian: patientId,
    isActive: true,
  } as unknown as QueryFilter<DependentData>);
}

export async function listDependentAppointments(
  patientId: Types.ObjectId,
  dependentId: Types.ObjectId,
): Promise<AppointmentDoc[]> {
  return Appointment.find({ patient: patientId, dependent: dependentId })
    .populate([servicePopulation, therapistPopulation])
    .sort({ scheduledStart: -1, createdAt: -1 });
}

export async function listDependentSessions(
  patientId: Types.ObjectId,
  dependentId: Types.ObjectId,
): Promise<SessionData[]> {
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

export async function updateDependent(
  patientId: Types.ObjectId,
  id: string,
  parsed: DependentUpdateInput,
): Promise<DependentDoc | null> {
  return Dependent.findOneAndUpdate(
    {
      _id: id,
      guardian: patientId,
      isActive: true,
    } as unknown as QueryFilter<DependentData>,
    { $set: parsed },
    { new: true, runValidators: true },
  );
}

export async function deactivateDependent(
  patientId: Types.ObjectId,
  id: string,
): Promise<DependentDoc | null> {
  return Dependent.findOneAndUpdate(
    {
      _id: id,
      guardian: patientId,
      isActive: true,
    } as unknown as QueryFilter<DependentData>,
    { $set: { isActive: false } },
    { new: true },
  );
}

export async function findService(
  id: string,
): Promise<TherapyServiceDoc | null> {
  return TherapyService.findOne({
    _id: id,
    isActive: true,
  } as unknown as QueryFilter<TherapyServiceData>);
}

export async function findOwnedDependent(
  patientId: Types.ObjectId,
  dependentId: string,
): Promise<DependentDoc | null> {
  return Dependent.findOne({
    _id: dependentId,
    guardian: patientId,
    isActive: true,
  } as unknown as QueryFilter<DependentData>);
}

export async function createAppointment(input: {
  patientId: Types.ObjectId;
  dependent: string | null;
  service: TherapyServiceDoc;
  requestedDate: string;
  requestedTime: string;
  notes: string;
}): Promise<AppointmentDoc> {
  const appointment = await Appointment.create({
    patient: input.patientId,
    dependent: input.dependent || null,
    service: input.service._id,
    requestedDate: input.requestedDate,
    requestedTime: input.requestedTime,
    notes: input.notes,
    status: "pending",
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

export async function findAdminIds(): Promise<Array<Pick<UserDoc, "_id">>> {
  return User.find({
    role: "admin",
    isActive: true,
    isArchived: false,
    removedAt: null,
  }).select("_id");
}

export async function listAppointments(
  patientId: Types.ObjectId,
  options: { status: string; page: number; limit: number },
): Promise<{ appointments: AppointmentDoc[]; total: number }> {
  const now = new Date();
  const query: Record<string, unknown> = { patient: patientId };
  let sort: Record<string, 1 | -1> = { scheduledStart: 1, requestedDate: 1 };

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

  const filter = query as unknown as QueryFilter<AppointmentData>;
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

export async function findOwnAppointment(
  patientId: Types.ObjectId,
  id: string,
): Promise<AppointmentDoc | null> {
  return Appointment.findOne({
    _id: id,
    patient: patientId,
  } as unknown as QueryFilter<AppointmentData>).populate([
    servicePopulation,
    therapistPopulation,
    {
      path: "dependent",
      select: "firstName lastName dateOfBirth relationship",
    },
  ]);
}

export async function saveAppointment(
  appointment: AppointmentDoc,
): Promise<void> {
  await appointment.save();
}

export async function findAppointmentCalendarFields(id: string): Promise<{
  googleEventId: string;
  googleEventLink: string;
} | null> {
  return Appointment.findById(id).select("googleEventId googleEventLink");
}

export async function listSessions(
  patientId: Types.ObjectId,
): Promise<SessionData[]> {
  return Session.find({ patient: patientId })
    .select(
      "sessionDate durationMinutes patientVisibleNotes appointment therapist service dependent",
    )
    .populate([servicePopulation, therapistPopulation])
    .sort({ sessionDate: -1 });
}

export async function findSession(
  patientId: Types.ObjectId,
  id: string,
): Promise<SessionData | null> {
  return Session.findOne({
    _id: id,
    patient: patientId,
  } as unknown as QueryFilter<SessionData>)
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

export async function listNotifications(
  patientId: Types.ObjectId,
  page: number,
  limit: number,
): Promise<{ notifications: NotificationData[]; total: number }> {
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

export async function markNotificationRead(
  patientId: Types.ObjectId,
  id: string,
): Promise<NotificationData | null> {
  return Notification.findOneAndUpdate(
    { _id: id, user: patientId } as unknown as QueryFilter<NotificationData>,
    { isRead: true },
    { new: true },
  );
}

export async function markAllNotificationsRead(
  patientId: Types.ObjectId,
): Promise<void> {
  await Notification.updateMany(
    { user: patientId, isRead: false },
    { isRead: true },
  );
}

export async function unreadNotificationCount(
  patientId: Types.ObjectId,
): Promise<number> {
  return Notification.countDocuments({ user: patientId, isRead: false });
}
