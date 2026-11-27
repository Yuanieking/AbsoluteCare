import { Router } from "express";
import {
  protectRoute,
  requireAccess,
  requirePermission,
  requireRole,
} from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
import { therapistOwnsAppointment } from "../middleware/appointmentScope.js";
import {
  approveReschedule,
  assignTherapist,
  cancelAppointment,
  confirmAppointment,
  declineReschedule,
  getAppointment,
  listAppointments,
  listAvailableTherapists,
  rescheduleAppointment,
  sendAppointmentNotification,
} from "../controllers/adminAppointmentController.js";

const router = Router();
router.param("id", objectIdParam);
router.param("id", therapistOwnsAppointment);
router.use(
  protectRoute,
  requireRole("admin", "secretary", "therapist"),
  requireAccess("appointments"),
);
// ** GET / - list appointments.
router.get("/", listAppointments);
// ** GET /:id - appointment details.
router.get("/:id", getAppointment);
// ** GET /:id/available-therapists - therapists free for this appointment.
router.get(
  "/:id/available-therapists",
  requireRole("admin", "secretary"),
  listAvailableTherapists,
);
// ** Concurrency: every PATCH below accepts If-Match: "<appointment.updatedAt>".
// ** A stale timestamp returns 409 { code: "STALE_RECORD" }; no header = unchecked.
// ** PATCH /:id/assign-therapist - assign a therapist to a pending appointment.
router.patch(
  "/:id/assign-therapist",
  requireRole("admin", "secretary"),
  requirePermission("appointments", "update"),
  assignTherapist,
);
// ** PATCH /:id/confirm - confirm a pending appointment.
router.patch(
  "/:id/confirm",
  requireRole("admin", "secretary"),
  requirePermission("appointments", "update"),
  confirmAppointment,
);
// ** PATCH /:id/reschedule - move a confirmed appointment.
router.patch(
  "/:id/reschedule",
  requirePermission("appointments", "update"),
  rescheduleAppointment,
);
// ** PATCH /:id/reschedule-request/approve - accept the open reschedule request.
router.patch(
  "/:id/reschedule-request/approve",
  requirePermission("appointments", "update"),
  approveReschedule,
);
// ** PATCH /:id/reschedule-request/decline - reject the open reschedule request.
router.patch(
  "/:id/reschedule-request/decline",
  requirePermission("appointments", "update"),
  declineReschedule,
);
// ** PATCH /:id/cancel - cancel a pending or confirmed appointment.
router.patch(
  "/:id/cancel",
  requirePermission("appointments", "update"),
  cancelAppointment,
);
// ** POST /:id/notification - send an appointment notification.
router.post(
  "/:id/notification",
  requirePermission("appointments", "update"),
  sendAppointmentNotification,
);

export default router;
