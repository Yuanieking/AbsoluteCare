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
router.get("/", listAuditHandler);
router.get("/export", requireRole("admin"), exportAuditHandler);
router.get("/:id", auditDetailHandler);
// No edit, delete, retention toggle or arbitrary user selector.
export default router;
