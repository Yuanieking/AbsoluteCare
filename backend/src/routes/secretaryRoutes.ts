import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
import {
  getAppointmentDetails,
  getProfile,
  listPayments,
  listSchedule,
  recordPayment,
  updatePayment,
  updateProfile,
} from "../controllers/secretaryController.js";

const router = Router();
router.param("id", objectIdParam);
router.use(protectRoute, requireRole("secretary"));
router.get("/profile", getProfile);
// ** PATCH /profile - update own profile. If-Match: "<profile.updatedAt>" -> 409 STALE_RECORD when stale.
router.patch("/profile", updateProfile);
router.get("/schedule", listSchedule);
router.get("/payments", listPayments);
router.get("/appointments/:id", getAppointmentDetails);
router.post("/appointments/:id/payment", recordPayment);
// ** PATCH /appointments/:id/payment - edit/mark unpaid. If-Match: "<appointment.updatedAt>" -> 409 when stale.
router.patch("/appointments/:id/payment", updatePayment);

export default router;
