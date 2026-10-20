import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  getAdminSettings,
  getAudit,
  getImpact,
  getIntegrationHealth,
  patchIntegration,
  getPublicSettings,
  patchSettings,
  confirmVerification,
  requestVerification,
  testEmail,
  testIntegration,
  getIntegrations,
} from "../controller/settingsController.js";

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const router = Router();
router.get("/public", (req, res, next) => {
  if (req.baseUrl === "/admin/settings") {
    return res.status(404).json({ message: "Not found." });
  }
  return getPublicSettings(req, res, next);
});
router.use(protectRoute, requireRole("admin"));
router.get("/", asyncRoute(getAdminSettings));
router.get("/integrations", asyncRoute(getIntegrations));
router.get("/integrations/health", asyncRoute(getIntegrationHealth));
router.post("/integrations/:key/test", asyncRoute(testIntegration));
router.patch("/integrations/:key", asyncRoute(patchIntegration));
router.post("/verification", asyncRoute(requestVerification));
router.post("/verification/confirm", asyncRoute(confirmVerification));
router.patch("/:section", asyncRoute(patchSettings));
router.get("/audit", asyncRoute(getAudit));
router.get("/impact", asyncRoute(getImpact));
router.post("/test-email", asyncRoute(testEmail));
export default router;
