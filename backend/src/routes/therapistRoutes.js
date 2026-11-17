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
// Own-account edits are not clinic-area permissions.
router.patch("/profile", updateProfile);
router.patch("/availability", updateAvailability);
router.get("/appointments", requireAccess("appointments"), listAppointments);
router.get("/appointments/:id", requireAccess("appointments"), getAppointment);
router.post(
  "/appointments/:id/reschedule-request",
  requirePermission("appointments", "update"),
  requestReschedule,
);
router.patch(
  "/appointments/:id/no-show",
  requirePermission("appointments", "update"),
  markNoShow,
);
router.post(
  "/appointments/:id/session",
  requirePermission("sessions", "create"),
  createSession,
);
router.post(
  "/appointments/:id/calendar-sync",
  requirePermission("appointments", "update"),
  syncCalendarAppointment,
);
router.get("/patients", requireAccess("patients"), listPatients);
router.get("/sessions", requireAccess("sessions"), listSessions);
router.get("/sessions/:id", requireAccess("sessions"), getSession);
router.patch(
  "/sessions/:id",
  requirePermission("sessions", "update"),
  updateSession,
);
router.get("/calendar/status", calendarStatus);

export default router;
