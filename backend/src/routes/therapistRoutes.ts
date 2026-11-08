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
} from "../controllers/therapistController.js";

const router = Router();
router.use(protectRoute, requireRole("therapist"));
router.get("/profile", getProfile);
// ** Concurrency: every PATCH here accepts If-Match: "<record.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /profile - update own profile.
router.patch("/profile", updateProfile);
// ** PATCH /availability - replace own working days/hours (guards the profile record).
router.patch("/availability", updateAvailability);
router.get("/appointments", listAppointments);
router.get("/appointments/:id", getAppointment);
router.post("/appointments/:id/reschedule-request", requestReschedule);
// ** PATCH /appointments/:id/no-show - mark own past appointment no-show.
router.patch("/appointments/:id/no-show", markNoShow);
router.post("/appointments/:id/session", createSession);
router.post("/appointments/:id/calendar-sync", syncCalendarAppointment);
router.get("/patients", listPatients);
router.get("/sessions", listSessions);
router.get("/sessions/:id", getSession);
// ** PATCH /sessions/:id - edit own session notes.
router.patch("/sessions/:id", updateSession);
router.get("/calendar/status", calendarStatus);

export default router;
