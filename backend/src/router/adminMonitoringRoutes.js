import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  recordPayment,
  updatePayment,
} from "../controller/secretaryController.js";
import {
  completeAppointment,
  exportPayments,
  listSessions,
  listPayments,
  markNoShow,
  reports,
} from "../controller/adminMonitoringController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
router.patch("/appointments/:id/complete", completeAppointment);
router.patch("/appointments/:id/no-show", markNoShow);
router.post("/appointments/:id/payment", recordPayment);
router.patch("/appointments/:id/payment", updatePayment);
router.get("/sessions", listSessions);
router.get("/payments", listPayments);
router.get("/reports", reports);
router.get("/reports/payments/export", exportPayments);

export default router;
