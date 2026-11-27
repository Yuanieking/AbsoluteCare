import { Router } from "express";
import {
  calendarCallback,
  calendarStatus,
  connectCalendar,
  disconnectCalendar,
} from "../controllers/calendarController.js";
import { protectRoute } from "../middleware/authMiddleware.js";
import { requirePatient } from "../middleware/patientMiddleware.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = Router();
// ** GET /google-calendar/callback - Google Calendar OAuth redirect target.
router.get("/google-calendar/callback", calendarCallback);
// ** GET /google-calendar/connect - start patient calendar connection.
router.get(
  "/google-calendar/connect",
  protectRoute,
  requirePatient,
  connectCalendar,
);
// ** GET /google-calendar/status - patient calendar connection status.
router.get(
  "/google-calendar/status",
  protectRoute,
  requirePatient,
  calendarStatus,
);
// ** POST /google-calendar/disconnect - disconnect patient calendar.
router.post(
  "/google-calendar/disconnect",
  protectRoute,
  requirePatient,
  disconnectCalendar,
);
// ** GET /google-calendar/therapist-connect - start therapist calendar connection.
router.get(
  "/google-calendar/therapist-connect",
  protectRoute,
  requireRole("therapist"),
  connectCalendar,
);
// ** GET /google-calendar/therapist-status - therapist calendar connection status.
router.get(
  "/google-calendar/therapist-status",
  protectRoute,
  requireRole("therapist"),
  calendarStatus,
);
// ** POST /google-calendar/therapist-disconnect - disconnect therapist calendar.
router.post(
  "/google-calendar/therapist-disconnect",
  protectRoute,
  requireRole("therapist"),
  disconnectCalendar,
);

export default router;
