import { Router } from "express";
import {
  calendarCallback,
  calendarStatus,
  connectCalendar,
  disconnectCalendar,
} from "../controller/calendarController.js";
import { protectRoute } from "../middleware/authMiddleware.js";
import { requirePatient } from "../middleware/patientMiddleware.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = Router();
router.get("/google-calendar/callback", calendarCallback);
router.get(
  "/google-calendar/connect",
  protectRoute,
  requirePatient,
  connectCalendar,
);
router.get(
  "/google-calendar/status",
  protectRoute,
  requirePatient,
  calendarStatus,
);
router.post(
  "/google-calendar/disconnect",
  protectRoute,
  requirePatient,
  disconnectCalendar,
);
router.get(
  "/google-calendar/therapist-connect",
  protectRoute,
  requireRole("therapist"),
  connectCalendar,
);
router.get(
  "/google-calendar/therapist-status",
  protectRoute,
  requireRole("therapist"),
  calendarStatus,
);
router.post(
  "/google-calendar/therapist-disconnect",
  protectRoute,
  requireRole("therapist"),
  disconnectCalendar,
);

export default router;
