import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  recordPayment,
  updatePayment,
} from "../controllers/secretaryController.js";
import {
  completeAppointment,
  exportPayments,
  listSessions,
  listPayments,
  markNoShow,
  reports,
} from "../controllers/adminMonitoringController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
// ** Concurrency: PATCH routes accept If-Match: "<appointment.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /appointments/:id/complete - mark a past confirmed appointment completed.
router.patch("/appointments/:id/complete", completeAppointment);
// ** PATCH /appointments/:id/no-show - mark a past confirmed appointment no-show.
router.patch("/appointments/:id/no-show", markNoShow);
router.post("/appointments/:id/payment", recordPayment);
// ** PATCH /appointments/:id/payment - edit payment or mark unpaid.
router.patch("/appointments/:id/payment", updatePayment);
router.get("/sessions", listSessions);
router.get("/payments", listPayments);
router.get("/reports", reports);
router.get("/reports/payments/export", exportPayments);

export default router;
