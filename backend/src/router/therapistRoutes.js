import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
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
} from "../controller/therapistController.js";

const router = Router();
router.use(protectRoute, requireRole("therapist"));
router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.patch("/availability", updateAvailability);
router.get("/appointments", listAppointments);
router.get("/appointments/:id", getAppointment);
router.post("/appointments/:id/reschedule-request", requestReschedule);
router.patch("/appointments/:id/no-show", markNoShow);
router.post("/appointments/:id/session", createSession);
router.post("/appointments/:id/calendar-sync", syncCalendarAppointment);
router.get("/patients", listPatients);
router.get("/sessions", listSessions);
router.get("/sessions/:id", getSession);
router.patch("/sessions/:id", updateSession);
router.get("/calendar/status", calendarStatus);

export default router;
