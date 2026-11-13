import { Router } from "express";
import {
  protectRoute,
  requireAccess,
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
router.post("/", asyncRoute(createDocumentHandler));
router.get("/", asyncRoute(listDocumentsHandler));
router.get("/:id", asyncRoute(getDocumentHandler));
router.get("/:id/file", asyncRoute(downloadDocumentHandler));
router.post("/:id/retry", asyncRoute(retryDocumentHandler));
router.post("/:id/revoke", asyncRoute(revokeDocumentHandler));

export default router;
