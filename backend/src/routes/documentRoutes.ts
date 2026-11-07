import { Router, type RequestHandler } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  createDocumentHandler,
  downloadDocumentHandler,
  getDocumentHandler,
  listDocumentsHandler,
  retryDocumentHandler,
  revokeDocumentHandler,
} from "../controllers/documentController.js";

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const router = Router();
router.use(protectRoute, requireRole("admin", "secretary", "therapist"));
router.post("/", asyncRoute(createDocumentHandler));
router.get("/", asyncRoute(listDocumentsHandler));
router.get("/:id", asyncRoute(getDocumentHandler));
router.get("/:id/file", asyncRoute(downloadDocumentHandler));
router.post("/:id/retry", asyncRoute(retryDocumentHandler));
router.post("/:id/revoke", asyncRoute(revokeDocumentHandler));

export default router;
