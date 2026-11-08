import type { Request, Response } from "express";
import {
  availabilitySchema,
  normalizeAvailability,
} from "../schemas/availabilitySchema.js";
import { rescheduleRequestSchema } from "../schemas/appointmentSchema.js";
import {
  sessionInputSchema,
  sessionUpdateSchema,
} from "../schemas/sessionSchema.js";
import {
  findConflicts,
  saveAvailability,
  scheduleConflictPayload,
  scheduleOf,
} from "../services/availabilityService.js";
import { syncConfirmedAppointment } from "../services/calendarService.js";
import { notify, notifyMany } from "../services/notificationService.js";
import * as therapistService from "../services/therapistService.js";
import { guardFresh } from "../services/concurrencyService.js";

const therapistId = (req: Request): string => req.user.userId;

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = await therapistService.getProfile(therapistId(req));
  if (!user) {
    res.status(404).json({ message: "Therapist profile not found." });
    return;
  }
  const profile = user.toObject() as unknown as Record<string, unknown>;
  profile.workingHoursByDay = scheduleOf(user);
  res.json({ profile });
}

export async function updateProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const allowed = [
    "firstname",
    "lastname",
    "phone",
    "profilePicture",
    "address",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed)
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  if (req.body.specialization !== undefined || req.body.role !== undefined) {
    res.status(400).json({
      message:
        "Specialization and role are managed by the clinic administrator.",
    });
    return;
  }
  const user = await therapistService.updateProfile(
    therapistId(req),
    updates,
    req.get("If-Match"),
  );
  res.json({ profile: user });
}

export async function updateAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = availabilitySchema.parse(req.body);
  const days = normalizeAvailability(parsed, req.body.workingHours);
  const user = await therapistService.getProfile(therapistId(req));
  if (!user) {
    res.status(404).json({ message: "Therapist profile not found." });
    return;
  }
  // ** Concurrency: reject if the profile changed since the client read it.
  guardFresh(user, req.get("If-Match"));
  const conflicts = await findConflicts(therapistId(req), days);
  if (conflicts.length) {
    res.status(409).json(scheduleConflictPayload(conflicts));
    return;
  }
  await saveAvailability({
    therapist: user,
    days,
    actorId: therapistId(req),
    byAdmin: false,
  });
  const profile = user.toObject() as unknown as Record<string, unknown>;
  profile.workingHoursByDay = days;
  res.json({ profile });
}

export async function listAppointments(
  req: Request,
  res: Response,
): Promise<void> {
  const appointments = await therapistService.listAppointments(
    therapistId(req),
    req.query.status as string | undefined,
  );
  res.json({ appointments });
}

export async function getAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  const appointment = await therapistService.getAppointment(
    therapistId(req),
    String(req.params.id),
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  res.json({ appointment });
}

export async function listPatients(req: Request, res: Response): Promise<void> {
  const { appointments, sessions, users } =
    await therapistService.listPatientRecords(therapistId(req));
  const patients = users.map((patient) => {
    const items = appointments.filter(
      (item) => item.patient.toString() === patient._id.toString(),
    );
    const next = items.find(
      (item) =>
        item.status === "confirmed" &&
        item.scheduledStart != null &&
        item.scheduledStart >= new Date(),
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

export async function requestReschedule(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = rescheduleRequestSchema.parse(req.body);
  const result = await therapistService.requestReschedule(
    therapistId(req),
    String(req.params.id),
    parsed,
  );
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }
  const appointment = result.appointment;
  const admins = await therapistService.listAdminIds();
  await notifyMany(admins, {
    type: "reschedule_requested",
    title: "Therapist reschedule request",
    message: `A therapist requested a new time for an appointment on ${parsed.proposedDate} at ${parsed.proposedTime}.`,
    appointment: appointment._id,
    dependent: appointment.dependent,
    link: `/staff/admin/appointments/${appointment._id}`,
    actorId: therapistId(req),
  });
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

export async function markNoShow(req: Request, res: Response): Promise<void> {
  const result = await therapistService.markNoShow(
    therapistId(req),
    String(req.params.id),
    req.get("If-Match"),
  );
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }
  const appointment = result.appointment;
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

export async function createSession(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = sessionInputSchema.parse(req.body);
  const result = await therapistService.createSessionForAppointment(
    therapistId(req),
    String(req.params.id),
    parsed,
  );
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }
  const { session, appointment } = result;
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

export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await therapistService.listSessions(
    therapistId(req),
    req.query.patient as string | undefined,
    req.query.appointment as string | undefined,
  );
  res.json({ sessions });
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const session = await therapistService.getSession(
    therapistId(req),
    String(req.params.id),
  );
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }
  res.json({ session });
}

export async function updateSession(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = sessionUpdateSchema.parse(req.body);
  const session = await therapistService.updateSession(
    therapistId(req),
    String(req.params.id),
    parsed,
    req.get("If-Match"),
  );
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }
  res.json({ session });
}

export async function calendarStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const user = await therapistService.getCalendar(therapistId(req));
  res.json({
    connected: Boolean(user!.googleCalendar?.connected),
    email: user!.googleCalendar?.email || "",
  });
}

export async function syncCalendarAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  const appointment = await therapistService.findOwnAppointment(
    therapistId(req),
    String(req.params.id),
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  await syncConfirmedAppointment(appointment._id, therapistId(req));
  res.json({ message: "Calendar sync requested." });
}
