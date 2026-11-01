import { Router, type RequestHandler } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  confirmVerification,
  downloadHandover,
  getAdminSettings,
  getAudit,
  getImpact,
  getIntegrationHealth,
  getIntegrations,
  getPublicSettings,
  patchIntegration,
  patchSettings,
  requestRestart,
  requestVerification,
  testEmail,
  testIntegration,
} from "../controllers/settingsController.js";
import {
  clearCredentialKey,
  getCredentialGroups,
  patchCredentials,
  rollbackCredentialKey,
  testCredentialGroup,
} from "../controllers/integrationCredentialController.js";

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const jsonOnly: RequestHandler = (req, res, next) =>
  req.is("application/json")
    ? next()
    : res.status(415).json({ message: "Send this request as JSON." });

const publicSettingsRoute: RequestHandler = async (req, res) => {
  if (req.baseUrl === "/admin/settings") {
    res.status(404).json({ message: "Not found." });
    return;
  }
  await getPublicSettings(req, res);
};

const router = Router();
router.get("/public", publicSettingsRoute);
router.use(protectRoute, requireRole("admin"));
router.get("/", asyncRoute(getAdminSettings));
router.get("/integrations", asyncRoute(getIntegrations));
router.get("/integrations/health", asyncRoute(getIntegrationHealth));
router.get("/integrations/credentials", asyncRoute(getCredentialGroups));
router.post(
  "/integrations/credentials/verification",
  asyncRoute(requestVerification),
);
router.patch(
  "/integrations/credentials",
  jsonOnly,
  asyncRoute(patchCredentials),
);
router.post(
  "/integrations/credentials/:key/clear",
  jsonOnly,
  asyncRoute(clearCredentialKey),
);
router.post(
  "/integrations/credentials/:key/rollback",
  jsonOnly,
  asyncRoute(rollbackCredentialKey),
);
router.post(
  "/integrations/credentials/:group/test",
  asyncRoute(testCredentialGroup),
);
router.post("/integrations/restart", asyncRoute(requestRestart));
router.get("/integrations/handover", asyncRoute(downloadHandover));
router.post("/integrations/:key/test", asyncRoute(testIntegration));
router.patch("/integrations/:key", asyncRoute(patchIntegration));
router.post("/verification", asyncRoute(requestVerification));
router.post("/verification/confirm", asyncRoute(confirmVerification));
router.patch("/:section", asyncRoute(patchSettings));
router.get("/audit", asyncRoute(getAudit));
router.get("/impact", asyncRoute(getImpact));
router.post("/test-email", asyncRoute(testEmail));
export default router;
