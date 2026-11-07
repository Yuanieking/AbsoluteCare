import { Router, type RequestHandler } from "express";
import { verifyDocumentHandler } from "../controllers/publicVerifyController.js";
import { verifyRateLimit } from "../middleware/verifyRateLimit.js";

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const router = Router();
// Public: no cookies, no protectRoute, only the in-memory rate limit.
router.get(
  "/:trackingNumber",
  verifyRateLimit,
  asyncRoute(verifyDocumentHandler),
);

export default router;
