import { Router } from "express";
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
  resetCredentialDefaults,
  testCredentialGroup,
} from "../controllers/integrationCredentialController.js";

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const jsonOnly = (req, res, next) =>
  req.is("application/json")
    ? next()
    : res.status(415).json({ message: "Send this request as JSON." });

const publicSettingsRoute = async (req, res) => {
  if (req.baseUrl === "/admin/settings") {
    res.status(404).json({ message: "Not found." });
    return;
  }
  await getPublicSettings(req, res);
};

const router = Router();
// ** GET /public - public settings (no sign-in).
router.get("/public", publicSettingsRoute);
router.use(protectRoute, requireRole("admin"));
// ** GET / - admin settings.
router.get("/", asyncRoute(getAdminSettings));
// ** GET /integrations - integration status.
router.get("/integrations", asyncRoute(getIntegrations));
// ** GET /integrations/health - integration health.
router.get("/integrations/health", asyncRoute(getIntegrationHealth));
// ** GET /integrations/credentials - credential groups.
router.get("/integrations/credentials", asyncRoute(getCredentialGroups));
// ** POST /integrations/credentials/verification - request a verification code.
router.post(
  "/integrations/credentials/verification",
  asyncRoute(requestVerification),
);
// ** PATCH /integrations/credentials - not timestamp-guarded: one request writes several
// ** credential records (no single updatedAt); the service has its own 409 confirmation flows.
router.patch(
  "/integrations/credentials",
  jsonOnly,
  asyncRoute(patchCredentials),
);
// ** POST /integrations/credentials/reset - reset credentials to defaults.
router.post(
  "/integrations/credentials/reset",
  jsonOnly,
  asyncRoute(resetCredentialDefaults),
);
// ** POST /integrations/credentials/:key/clear - clear one credential.
router.post(
  "/integrations/credentials/:key/clear",
  jsonOnly,
  asyncRoute(clearCredentialKey),
);
// ** POST /integrations/credentials/:key/rollback - roll back one credential.
router.post(
  "/integrations/credentials/:key/rollback",
  jsonOnly,
  asyncRoute(rollbackCredentialKey),
);
// ** POST /integrations/credentials/:group/test - test a credential group.
router.post(
  "/integrations/credentials/:group/test",
  asyncRoute(testCredentialGroup),
);
// ** POST /integrations/restart - request a server restart.
router.post("/integrations/restart", asyncRoute(requestRestart));
// ** GET /integrations/handover - download the handover file.
router.get("/integrations/handover", asyncRoute(downloadHandover));
// ** POST /integrations/:key/test - test an integration.
router.post("/integrations/:key/test", asyncRoute(testIntegration));
// ** PATCH /integrations/:key - toggle an integration. If-Match: "<settings.updatedAt>" -> 409 when stale.
router.patch("/integrations/:key", asyncRoute(patchIntegration));
// ** POST /verification - request a verification code.
router.post("/verification", asyncRoute(requestVerification));
// ** POST /verification/confirm - confirm a verification code.
router.post("/verification/confirm", asyncRoute(confirmVerification));
// ** PATCH /:section - replace one settings section. If-Match: "<settings.updatedAt>" -> 409 when stale.
router.patch("/:section", asyncRoute(patchSettings));
// ** GET /audit - settings audit log.
router.get("/audit", asyncRoute(getAudit));
// ** GET /impact - impact of a settings change.
router.get("/impact", asyncRoute(getImpact));
// ** POST /test-email - send a test email.
router.post("/test-email", asyncRoute(testEmail));
export default router;
