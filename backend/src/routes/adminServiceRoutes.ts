import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  createService,
  getServiceUsage,
  listServices,
  removeService,
  updateService,
} from "../controllers/adminServiceController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
router.get("/", listServices);
router.post("/", createService);
router.get("/:id/usage", getServiceUsage);
// ** Concurrency: PATCH/DELETE accept If-Match: "<service.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /:id - edit a therapy service.
router.patch("/:id", updateService);
// ** DELETE /:id - retire a therapy service from new bookings (soft delete).
router.delete("/:id", removeService);

export default router;
