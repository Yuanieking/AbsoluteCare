import { Router } from "express";
import {
  cancelAppointment,
  createDependent,
  getAppointment,
  getDependent,
  getSession,
  listAppointments,
  listDependents,
  listNotifications,
  listServices,
  listBookingTimes,
  listSessions,
  markAllNotificationsRead,
  markNotificationRead,
  requestAppointment,
  requestReschedule,
  removeDependent,
  syncAppointmentCalendar,
  updateDependent,
  unreadNotificationCount,
} from "../controllers/patientController.js";
import { protectRoute } from "../middleware/authMiddleware.js";
import { requirePatient } from "../middleware/patientMiddleware.js";
import { validateObjectIdParams } from "../middleware/validateObjectId.js";

const router = Router();
const patientOnly = [
  protectRoute,
  requirePatient,
  validateObjectIdParams("id"),
];

// ** GET /services - list bookable services.
router.get("/services", patientOnly, listServices);
// ** GET /availability - open booking times.
router.get("/availability", patientOnly, listBookingTimes);
// ** GET /dependents - list dependents.
router.get("/dependents", patientOnly, listDependents);
// ** POST /dependents - add a dependent.
router.post("/dependents", patientOnly, createDependent);
// ** GET /dependents/:id - dependent details.
router.get("/dependents/:id", patientOnly, getDependent);
// ** Concurrency: PATCH/DELETE accept If-Match: "<dependent.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /dependents/:id - edit a dependent.
router.patch("/dependents/:id", patientOnly, updateDependent);
// ** DELETE /dependents/:id - deactivate a dependent (soft delete).
router.delete("/dependents/:id", patientOnly, removeDependent);
// ** POST /appointments - request an appointment.
router.post("/appointments", patientOnly, requestAppointment);
// ** GET /appointments - list own appointments.
router.get("/appointments", patientOnly, listAppointments);
// ** GET /appointments/:id - appointment details.
router.get("/appointments/:id", patientOnly, getAppointment);
// ** POST /appointments/:id/reschedule-request - request a new time.
router.post(
  "/appointments/:id/reschedule-request",
  patientOnly,
  requestReschedule,
);
// ** POST /appointments/:id/cancel - cancel an appointment.
router.post("/appointments/:id/cancel", patientOnly, cancelAppointment);
// ** POST /appointments/:id/calendar-sync - sync an appointment to Google Calendar.
router.post(
  "/appointments/:id/calendar-sync",
  patientOnly,
  syncAppointmentCalendar,
);
// ** GET /sessions - list own sessions.
router.get("/sessions", patientOnly, listSessions);
// ** GET /sessions/:id - session details.
router.get("/sessions/:id", patientOnly, getSession);
// ** GET /notifications - list notifications.
router.get("/notifications", patientOnly, listNotifications);
// ** PATCH /notifications/:id/read - If-Match: "<notification.updatedAt>" -> 409 when stale.
router.patch("/notifications/:id/read", patientOnly, markNotificationRead);
// ** PATCH /notifications/read-all - bulk write, no single record to timestamp-guard.
router.patch("/notifications/read-all", patientOnly, markAllNotificationsRead);
// ** GET /notifications/unread-count - unread notification count.
router.get("/notifications/unread-count", patientOnly, unreadNotificationCount);

export default router;
