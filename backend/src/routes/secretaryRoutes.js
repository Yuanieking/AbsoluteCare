import { Router } from "express";
import {
  protectRoute,
  requireAccess,
  requirePermission,
  requireRole,
} from "../middleware/authMiddleware.js";
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
router.get("/schedule", requireAccess("appointments"), listSchedule);
router.get("/payments", requireAccess("payments"), listPayments);
router.get(
  "/appointments/:id",
  requireAccess("appointments"),
  getAppointmentDetails,
);
router.post(
  "/appointments/:id/payment",
  requirePermission("payments", "create"),
  requireAccess("payments"),
  recordPayment,
);
// ** PATCH /appointments/:id/payment - edit/mark unpaid. If-Match: "<appointment.updatedAt>" -> 409 when stale.
router.patch(
  "/appointments/:id/payment",
  requirePermission("payments", "update"),
  requireAccess("payments"),
  updatePayment,
);

export default router;
