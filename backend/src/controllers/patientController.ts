import type { Request, Response } from "express";
import {
  appointmentRequestSchema,
  rescheduleRequestSchema,
} from "../schemas/appointmentSchema.js";
import {
  dependentSchema,
  dependentUpdateSchema,
} from "../schemas/dependentSchema.js";
import {
  isValidFutureDate,
  manilaDateTime,
} from "../utils/appointmentDates.js";
import {
  deleteCalendarEvent,
  syncConfirmedAppointment,
} from "../services/calendarService.js";
import { notify, notifyMany } from "../services/notificationService.js";
import * as patientService from "../services/patientService.js";

function queryInt(value: unknown, fallback: string): number {
  return Number.parseInt(String(value || fallback), 10);
}

export async function listServices(req: Request, res: Response): Promise<void> {
  const services = await patientService.listPublicServices();
  res.json({ services });
}

export async function listDependents(
  req: Request,
  res: Response,
): Promise<void> {
  const patientId = req.patient!._id;
  const dependents =
    await patientService.listDependentsWithNextAppointment(patientId);
  res.json({ dependents });
}

export async function createDependent(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = dependentSchema.parse(req.body);
  const dependent = await patientService.createDependent(
    req.patient!._id,
    parsed,
  );
  res.status(201).json({ dependent });
}

export async function getDependent(req: Request, res: Response): Promise<void> {
  const patientId = req.patient!._id;
  const dependent = await patientService.findDependent(
    patientId,
    req.params.id as string,
  );
  if (!dependent) {
    res.status(404).json({ message: "Dependent not found." });
    return;
  }

  const [appointments, sessions] = await Promise.all([
    patientService.listDependentAppointments(patientId, dependent._id),
    patientService.listDependentSessions(patientId, dependent._id),
  ]);
  res.json({ dependent, appointments, sessions });
}

export async function updateDependent(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = dependentUpdateSchema.parse(req.body);
  const dependent = await patientService.updateDependent(
    req.patient!._id,
    req.params.id as string,
    parsed,
  );
  if (!dependent) {
    res.status(404).json({ message: "Dependent not found." });
    return;
  }
  res.json({ dependent });
}

export async function removeDependent(
  req: Request,
  res: Response,
): Promise<void> {
  const dependent = await patientService.deactivateDependent(
    req.patient!._id,
    req.params.id as string,
  );
  if (!dependent) {
    res.status(404).json({ message: "Dependent not found." });
    return;
  }
  res.json({ message: "Dependent removed." });
}

export async function requestAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = appointmentRequestSchema.parse(req.body);
  const patientId = req.patient!._id;
  const service = await patientService.findService(parsed.service);
  if (!service) {
    res.status(400).json({ message: "That therapy service is not available." });
    return;
  }
  if (!isValidFutureDate(parsed.requestedDate, parsed.requestedTime)) {
    res.status(400).json({ message: "Choose a future date and time." });
    return;
  }

  if (parsed.dependent) {
    const dependent = await patientService.findOwnedDependent(
      patientId,
      parsed.dependent,
    );
    if (!dependent) {
      res.status(400).json({ message: "That dependent is not available." });
      return;
    }
  }

  const appointment = await patientService.createAppointment({
    patientId,
    dependent: parsed.dependent || null,
    service,
    requestedDate: parsed.requestedDate,
    requestedTime: parsed.requestedTime,
    notes: parsed.notes,
  });

  const admins = await patientService.findAdminIds();
  await notifyMany(
    admins.map((admin) => admin._id),
    {
      type: "appointment_requested",
      title: "New appointment request",
      message: `${req.patient!.firstname} ${req.patient!.lastname} requested ${service.name}.`,
      appointment: appointment._id,
      dependent: appointment.dependent,
      link: `/staff/admin/appointments/${appointment._id}`,
      actorId: patientId,
    },
  );
  res.status(201).json({ appointment });
}

export async function listAppointments(
  req: Request,
  res: Response,
): Promise<void> {
  const page = Math.max(queryInt(req.query.page, "1"), 1);
  const limit = Math.min(Math.max(queryInt(req.query.limit, "10"), 1), 50);
  const status = String(req.query.status || "upcoming");

  const result = await patientService.listAppointments(req.patient!._id, {
    status,
    page,
    limit,
  });

  res.json({
    appointments: result.appointments,
    page,
    limit,
    total: result.total,
  });
}

export async function getAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  const appointment = await patientService.findOwnAppointment(
    req.patient!._id,
    req.params.id as string,
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  res.json({ appointment });
}

export async function requestReschedule(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = rescheduleRequestSchema.parse(req.body);
  const patientId = req.patient!._id;
  const appointment = await patientService.findOwnAppointment(
    patientId,
    req.params.id as string,
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  if (!["pending", "confirmed"].includes(appointment.status)) {
    res
      .status(400)
      .json({ message: "This appointment can no longer be rescheduled." });
    return;
  }
  const currentStart =
    appointment.scheduledStart ||
    manilaDateTime(appointment.requestedDate, appointment.requestedTime);
  if (
    currentStart <= new Date() ||
    !isValidFutureDate(parsed.proposedDate, parsed.proposedTime)
  ) {
    res
      .status(400)
      .json({ message: "Choose a future reschedule date and time." });
    return;
  }
  if (appointment.rescheduleRequest?.status === "requested") {
    res.status(409).json({ message: "A reschedule request is already open." });
    return;
  }

  appointment.rescheduleRequest = {
    status: "requested",
    proposedDate: parsed.proposedDate,
    proposedTime: parsed.proposedTime,
    reason: parsed.reason,
    requestedAt: new Date(),
    requestedBy: "patient",
  };
  await patientService.saveAppointment(appointment);
  const admins = await patientService.findAdminIds();
  await notifyMany(
    admins.map((admin) => admin._id),
    {
      type: "reschedule_requested",
      title: "Reschedule request",
      message: `A patient requested a new time for an appointment on ${parsed.proposedDate} at ${parsed.proposedTime}.`,
      appointment: appointment._id,
      dependent: appointment.dependent,
      link: `/staff/admin/appointments/${appointment._id}`,
      actorId: patientId,
    },
  );
  res.json({ appointment });
}

export async function cancelAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  const patientId = req.patient!._id;
  const appointment = await patientService.findOwnAppointment(
    patientId,
    req.params.id as string,
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  const start =
    appointment.scheduledStart ||
    manilaDateTime(appointment.requestedDate, appointment.requestedTime);
  if (
    !["pending", "confirmed"].includes(appointment.status) ||
    start.getTime() - Date.now() < 24 * 60 * 60 * 1000
  ) {
    res.status(400).json({
      message:
        "This appointment cannot be cancelled within 24 hours of the visit.",
    });
    return;
  }
  appointment.status = "cancelled";
  appointment.cancelReason =
    (req.body?.reason as string | undefined)?.trim() || "Cancelled by patient";
  appointment.cancelledBy = patientId;
  await patientService.saveAppointment(appointment);
  await deleteCalendarEvent(appointment);
  if (appointment.therapist) {
    await notify({
      user: appointment.therapist,
      type: "appointment_cancelled",
      title: "Appointment cancelled",
      message: `An appointment was cancelled: ${appointment.cancelReason}`,
      appointment: appointment._id,
      dependent: appointment.dependent,
      link: `/staff/therapist/appointments/${appointment._id}`,
      actorId: patientId,
    });
  }
  res.json({ appointment });
}

export async function syncAppointmentCalendar(
  req: Request,
  res: Response,
): Promise<void> {
  const appointment = await patientService.findOwnAppointment(
    req.patient!._id,
    req.params.id as string,
  );
  if (!appointment) {
    res.status(404).json({ message: "Appointment not found." });
    return;
  }
  if (appointment.status !== "confirmed") {
    res.status(400).json({
      message: "Only confirmed appointments can be added to Google Calendar.",
    });
    return;
  }

  try {
    await syncConfirmedAppointment(appointment._id);
    const refreshed = await patientService.findAppointmentCalendarFields(
      appointment._id.toString(),
    );
    res.json({
      googleEventId: refreshed!.googleEventId,
      googleEventLink: refreshed!.googleEventLink,
    });
  } catch (error) {
    res.status(502).json({
      message: (error as Error).message || "Google Calendar is unavailable.",
    });
  }
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await patientService.listSessions(req.patient!._id);
  res.json({ sessions });
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const session = await patientService.findSession(
    req.patient!._id,
    req.params.id as string,
  );
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }
  res.json({ session });
}

export async function listNotifications(
  req: Request,
  res: Response,
): Promise<void> {
  const page = Math.max(queryInt(req.query.page, "1"), 1);
  const limit = Math.min(Math.max(queryInt(req.query.limit, "20"), 1), 50);
  const result = await patientService.listNotifications(
    req.patient!._id,
    page,
    limit,
  );
  res.json({
    notifications: result.notifications,
    page,
    limit,
    total: result.total,
  });
}

export async function markNotificationRead(
  req: Request,
  res: Response,
): Promise<void> {
  const notification = await patientService.markNotificationRead(
    req.patient!._id,
    req.params.id as string,
  );
  if (!notification) {
    res.status(404).json({ message: "Notification not found." });
    return;
  }
  res.json({ notification });
}

export async function markAllNotificationsRead(
  req: Request,
  res: Response,
): Promise<void> {
  await patientService.markAllNotificationsRead(req.patient!._id);
  res.status(204).send();
}

export async function unreadNotificationCount(
  req: Request,
  res: Response,
): Promise<void> {
  const count = await patientService.unreadNotificationCount(req.patient!._id);
  res.json({ count });
}
