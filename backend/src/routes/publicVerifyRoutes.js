import { Router } from "express";
import { verifyDocumentHandler } from "../controllers/publicVerifyController.js";
import { verifyRateLimit } from "../middleware/verifyRateLimit.js";

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const router = Router();
// ** GET /:trackingNumber - public document verification (rate limited, no sign-in).
router.get(
  "/:trackingNumber",
  verifyRateLimit,
  asyncRoute(verifyDocumentHandler),
);

export default router;
