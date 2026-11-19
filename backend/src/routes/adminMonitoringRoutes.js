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
router.param("id", objectIdParam);
router.param("id", therapistOwnsAppointment);
router.use(protectRoute, requireRole("admin", "secretary", "therapist"));
// ** Concurrency: PATCH routes accept If-Match: "<appointment.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /appointments/:id/complete - mark a past confirmed appointment completed.
router.patch(
  "/appointments/:id/complete",
  requirePermission("appointments", "update"),
  completeAppointment,
);
// ** PATCH /appointments/:id/no-show - mark a past confirmed appointment no-show.
router.patch(
  "/appointments/:id/no-show",
  requirePermission("appointments", "update"),
  markNoShow,
);
router.post(
  "/appointments/:id/payment",
  requirePermission("payments", "create"),
  recordPayment,
);
// ** PATCH /appointments/:id/payment - edit payment or mark unpaid.
router.patch(
  "/appointments/:id/payment",
  requirePermission("payments", "update"),
  updatePayment,
);
router.get("/sessions", requireAccess("sessions"), listSessions);
router.get("/payments", requireAccess("payments"), listPayments);
router.get("/reports", requireAccess("reports"), reports);
router.get(
  "/reports/payments/export",
  requireAccess("reports"),
  exportPayments,
);

export default router;
