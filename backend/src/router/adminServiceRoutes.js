import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  createService,
  getServiceUsage,
  listServices,
  removeService,
  updateService,
} from "../controller/adminServiceController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
router.get("/", listServices);
router.post("/", createService);
router.get("/:id/usage", getServiceUsage);
router.patch("/:id", updateService);
router.delete("/:id", removeService);

export default router;
