import { Router } from "express";
import {
  protectRoute,
  requireAccess,
  requireRole,
} from "../middleware/authMiddleware.js";
import {
  connectDrive,
  disconnectDrive,
  driveCallback,
  driveStatus,
  testDrive,
} from "../controllers/googleDriveController.js";

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const router = Router();
// ** GET /google-drive/callback - Google Drive OAuth redirect target.
router.get("/google-drive/callback", asyncRoute(driveCallback));
// ** GET /google-drive/connect - start Drive connection.
router.get(
  "/google-drive/connect",
  protectRoute,
  requireRole("admin"),
  asyncRoute(connectDrive),
);
// ** GET /google-drive/status - Drive connection status.
router.get(
  "/google-drive/status",
  protectRoute,
  requireRole("admin", "secretary"),
  requireAccess("driveStatus"),
  asyncRoute(driveStatus),
);
// ** POST /google-drive/disconnect - disconnect Drive.
router.post(
  "/google-drive/disconnect",
  protectRoute,
  requireRole("admin"),
  asyncRoute(disconnectDrive),
);
// ** POST /google-drive/test - test the Drive connection.
router.post(
  "/google-drive/test",
  protectRoute,
  requireRole("admin"),
  asyncRoute(testDrive),
);

export default router;
