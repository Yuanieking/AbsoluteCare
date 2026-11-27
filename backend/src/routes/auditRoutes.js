import { Router } from "express";
import {
  protectRoute,
  requireAccess,
  requireRole,
} from "../middleware/authMiddleware.js";
import {
  auditDetailHandler,
  exportAuditHandler,
  listAuditHandler,
} from "../controllers/auditController.js";

const router = Router();
router.use(
  protectRoute,
  requireRole("admin", "secretary", "therapist", "user"),
  requireAccess("myActivity"),
);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
// ** GET / - list audit activity.
router.get("/", listAuditHandler);
// ** GET /export - export the audit log (admin).
router.get("/export", requireRole("admin"), exportAuditHandler);
// ** GET /:id - audit entry details.
router.get("/:id", auditDetailHandler);
export default router;
