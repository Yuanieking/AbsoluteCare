import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
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
} from "../controller/adminAppointmentController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
router.get("/", listAppointments);
router.get("/:id", getAppointment);
router.get("/:id/available-therapists", listAvailableTherapists);
router.patch("/:id/assign-therapist", assignTherapist);
router.patch("/:id/confirm", confirmAppointment);
router.patch("/:id/reschedule", rescheduleAppointment);
router.patch("/:id/reschedule-request/approve", approveReschedule);
router.patch("/:id/reschedule-request/decline", declineReschedule);
router.patch("/:id/cancel", cancelAppointment);

export default router;
