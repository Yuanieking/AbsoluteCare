import express, { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import { exportBackup, importBackup } from "../controllers/backupController.js";

const router = Router();
// Mounted after cookieParser, before the default JSON parser. Authorize before
// accepting the larger upload; never put verification tokens in URLs or logs.
router.use(protectRoute, requireRole("admin"));
// JSON-encoding an Extended JSON string can nearly double its byte length.
router.use(express.json({ limit: "66mb" }));
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.post("/export", exportBackup);
router.post("/restore", importBackup);
export default router;
