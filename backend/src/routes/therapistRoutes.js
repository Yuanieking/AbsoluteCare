import { Router } from "express";
import {
  protectRoute,
  requireAccess,
  requirePermission,
  requireRole,
} from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
import {
  getProfile,
  updateProfile,
  updateAvailability,
  listAppointments,
  getAppointment,
  listPatients,
  requestReschedule,
  markNoShow,
  createSession,
  listSessions,
  getSession,
  updateSession,
  calendarStatus,
  syncCalendarAppointment,
} from "../controllers/therapistController.js";

const router = Router();
router.param("id", objectIdParam);
router.use(protectRoute, requireRole("therapist"));
// ** GET /profile - own profile.
router.get("/profile", getProfile);
// ** PATCH /profile - update own profile.
router.patch("/profile", updateProfile);
// ** PATCH /availability - update own availability.
router.patch("/availability", updateAvailability);
// ** GET /appointments - list assigned appointments.
router.get("/appointments", requireAccess("appointments"), listAppointments);
// ** GET /appointments/:id - appointment details.
router.get("/appointments/:id", requireAccess("appointments"), getAppointment);
// ** POST /appointments/:id/reschedule-request - request a new time.
router.post(
  "/appointments/:id/reschedule-request",
  requirePermission("appointments", "update"),
  requestReschedule,
);
// ** PATCH /appointments/:id/no-show - mark an appointment no-show.
router.patch(
  "/appointments/:id/no-show",
  requirePermission("appointments", "update"),
  markNoShow,
);
// ** POST /appointments/:id/session - create session notes.
router.post(
  "/appointments/:id/session",
  requirePermission("sessions", "create"),
  createSession,
);
// ** POST /appointments/:id/calendar-sync - sync an appointment to Google Calendar.
router.post(
  "/appointments/:id/calendar-sync",
  requirePermission("appointments", "update"),
  syncCalendarAppointment,
);
// ** GET /patients - list own patients.
router.get("/patients", requireAccess("patients"), listPatients);
// ** GET /sessions - list sessions.
router.get("/sessions", requireAccess("sessions"), listSessions);
// ** GET /sessions/:id - session details.
router.get("/sessions/:id", requireAccess("sessions"), getSession);
// ** PATCH /sessions/:id - update session notes.
router.patch(
  "/sessions/:id",
  requirePermission("sessions", "update"),
  updateSession,
);
// ** GET /calendar/status - calendar connection status.
router.get("/calendar/status", calendarStatus);

export default router;
