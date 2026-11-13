import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
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
router.use(protectRoute, requireRole("admin"));
router.get("/", listAppointments);
router.get("/:id", getAppointment);
router.get("/:id/available-therapists", listAvailableTherapists);
// ** Concurrency: every PATCH below accepts If-Match: "<appointment.updatedAt>".
// ** A stale timestamp returns 409 { code: "STALE_RECORD" }; no header = unchecked.
// ** PATCH /:id/assign-therapist - assign a therapist to a pending appointment.
router.patch("/:id/assign-therapist", assignTherapist);
// ** PATCH /:id/confirm - confirm a pending appointment.
router.patch("/:id/confirm", confirmAppointment);
// ** PATCH /:id/reschedule - move a confirmed appointment.
router.patch("/:id/reschedule", rescheduleAppointment);
// ** PATCH /:id/reschedule-request/approve - accept the open reschedule request.
router.patch("/:id/reschedule-request/approve", approveReschedule);
// ** PATCH /:id/reschedule-request/decline - reject the open reschedule request.
router.patch("/:id/reschedule-request/decline", declineReschedule);
// ** PATCH /:id/cancel - cancel a pending or confirmed appointment.
router.patch("/:id/cancel", cancelAppointment);
router.post("/:id/notification", sendAppointmentNotification);

export default router;
