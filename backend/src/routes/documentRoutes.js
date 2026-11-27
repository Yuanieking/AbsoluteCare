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
const createPermission = (req, res, next) =>
  requirePermission(
    req.body?.type === "clinic_report" ? "reports" : "documents",
    "create",
  )(req, res, next);
// ** POST / - generate a document.
router.post("/", createPermission, asyncRoute(createDocumentHandler));
// ** GET / - list documents.
router.get("/", asyncRoute(listDocumentsHandler));
// ** GET /:id - document details.
router.get("/:id", asyncRoute(getDocumentHandler));
// ** GET /:id/file - download the PDF.
router.get("/:id/file", asyncRoute(downloadDocumentHandler));
// ** POST /:id/retry - retry the Drive upload.
router.post(
  "/:id/retry",
  requirePermission("documents", "update"),
  asyncRoute(retryDocumentHandler),
);
// ** POST /:id/revoke - revoke a document.
router.post(
  "/:id/revoke",
  requirePermission("documents", "delete"),
  asyncRoute(revokeDocumentHandler),
);

export default router;
