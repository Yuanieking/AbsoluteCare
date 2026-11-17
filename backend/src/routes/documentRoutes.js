import { Router } from "express";
import {
  protectRoute,
  requireAccess,
  requirePermission,
  requireRole,
} from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
import {
  createDocumentHandler,
  downloadDocumentHandler,
  getDocumentHandler,
  listDocumentsHandler,
  retryDocumentHandler,
  revokeDocumentHandler,
} from "../controllers/documentController.js";

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const router = Router();
router.param("id", objectIdParam);
router.use(
  protectRoute,
  requireRole("admin", "secretary", "therapist"),
  requireAccess("documents"),
);
router.post(
  "/",
  requirePermission("documents", "create"),
  asyncRoute(createDocumentHandler),
);
router.get("/", asyncRoute(listDocumentsHandler));
router.get("/:id", asyncRoute(getDocumentHandler));
router.get("/:id/file", asyncRoute(downloadDocumentHandler));
router.post(
  "/:id/retry",
  requirePermission("documents", "update"),
  asyncRoute(retryDocumentHandler),
);
router.post(
  "/:id/revoke",
  requirePermission("documents", "delete"),
  asyncRoute(revokeDocumentHandler),
);

export default router;
