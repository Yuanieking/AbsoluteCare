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
router.get("/profile", getProfile);
// ** Concurrency: every PATCH here accepts If-Match: "<record.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /profile - update own profile.
router.patch("/profile", updateProfile);
// ** PATCH /availability - replace own working days/hours (guards the profile record).
router.patch("/availability", updateAvailability);
router.get("/appointments", requireAccess("appointments"), listAppointments);
router.get("/appointments/:id", requireAccess("appointments"), getAppointment);
router.post(
  "/appointments/:id/reschedule-request",
  requireAccess("appointments"),
  requestReschedule,
);
// ** PATCH /appointments/:id/no-show - mark own past appointment no-show.
router.patch(
  "/appointments/:id/no-show",
  requireAccess("appointments"),
  markNoShow,
);
router.post(
  "/appointments/:id/session",
  requirePermission("sessions", "create"),
  requireAccess("sessions"),
  createSession,
);
router.post(
  "/appointments/:id/calendar-sync",
  requireAccess("appointments"),
  syncCalendarAppointment,
);
router.get("/patients", requireAccess("patients"), listPatients);
router.get("/sessions", requireAccess("sessions"), listSessions);
router.get("/sessions/:id", requireAccess("sessions"), getSession);
// ** PATCH /sessions/:id - edit own session notes.
router.patch(
  "/sessions/:id",
  requirePermission("sessions", "update"),
  requireAccess("sessions"),
  updateSession,
);
router.get("/calendar/status", calendarStatus);

export default router;
