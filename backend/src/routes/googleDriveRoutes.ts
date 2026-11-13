import { Router, type RequestHandler } from "express";
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

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const router = Router();
router.get("/google-drive/callback", asyncRoute(driveCallback));
router.get(
  "/google-drive/connect",
  protectRoute,
  requireRole("admin"),
  asyncRoute(connectDrive),
);
router.get(
  "/google-drive/status",
  protectRoute,
  requireRole("admin", "secretary"),
  requireAccess("driveStatus"),
  asyncRoute(driveStatus),
);
router.post(
  "/google-drive/disconnect",
  protectRoute,
  requireRole("admin"),
  asyncRoute(disconnectDrive),
);
router.post(
  "/google-drive/test",
  protectRoute,
  requireRole("admin"),
  asyncRoute(testDrive),
);

export default router;
