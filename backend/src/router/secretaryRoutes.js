import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  getAppointmentDetails,
  getProfile,
  listPayments,
  listSchedule,
  recordPayment,
  updatePayment,
  updateProfile,
} from "../controller/secretaryController.js";

const router = Router();
router.use(protectRoute, requireRole("secretary"));
router.get("/profile", getProfile);
router.patch("/profile", updateProfile);
router.get("/schedule", listSchedule);
router.get("/payments", listPayments);
router.get("/appointments/:id", getAppointmentDetails);
router.post("/appointments/:id/payment", recordPayment);
router.patch("/appointments/:id/payment", updatePayment);

export default router;
