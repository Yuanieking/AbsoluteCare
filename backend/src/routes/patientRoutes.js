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

router.get("/services", patientOnly, listServices);
router.get("/dependents", patientOnly, listDependents);
router.post("/dependents", patientOnly, createDependent);
router.get("/dependents/:id", patientOnly, getDependent);
// ** Concurrency: PATCH/DELETE accept If-Match: "<dependent.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /dependents/:id - edit a dependent.
router.patch("/dependents/:id", patientOnly, updateDependent);
// ** DELETE /dependents/:id - deactivate a dependent (soft delete).
router.delete("/dependents/:id", patientOnly, removeDependent);
router.post("/appointments", patientOnly, requestAppointment);
router.get("/appointments", patientOnly, listAppointments);
router.get("/appointments/:id", patientOnly, getAppointment);
router.post(
  "/appointments/:id/reschedule-request",
  patientOnly,
  requestReschedule,
);
router.post("/appointments/:id/cancel", patientOnly, cancelAppointment);
router.post(
  "/appointments/:id/calendar-sync",
  patientOnly,
  syncAppointmentCalendar,
);
router.get("/sessions", patientOnly, listSessions);
router.get("/sessions/:id", patientOnly, getSession);
router.get("/notifications", patientOnly, listNotifications);
// ** PATCH /notifications/:id/read - If-Match: "<notification.updatedAt>" -> 409 when stale.
router.patch("/notifications/:id/read", patientOnly, markNotificationRead);
// ** PATCH /notifications/read-all - bulk write, no single record to timestamp-guard.
router.patch("/notifications/read-all", patientOnly, markAllNotificationsRead);
router.get("/notifications/unread-count", patientOnly, unreadNotificationCount);

export default router;
