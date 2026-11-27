import express, { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import { exportBackup, importBackup } from "../controllers/backupController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
router.use(express.json({ limit: "66mb" }));
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
// ** POST /export - download a database backup.
router.post("/export", exportBackup);
// ** POST /restore - restore a database backup.
router.post("/restore", importBackup);
export default router;
