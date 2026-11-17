import { Router } from "express";
import {
  protectRoute,
  requireAccess,
  requirePermission,
  requireRole,
} from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
import {
  createService,
  getServiceUsage,
  listServices,
  removeService,
  updateService,
} from "../controllers/adminServiceController.js";

const router = Router();
router.param("id", objectIdParam);
router.use(
  protectRoute,
  requireRole("admin", "secretary", "therapist"),
  requireAccess("services"),
);
router.get("/", listServices);
router.post("/", requirePermission("services", "create"), createService);
router.get("/:id/usage", getServiceUsage);
// ** Concurrency: PATCH/DELETE accept If-Match: "<service.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /:id - edit a therapy service.
router.patch("/:id", requirePermission("services", "update"), updateService);
// ** DELETE /:id - retire a therapy service from new bookings (soft delete).
router.delete("/:id", requirePermission("services", "delete"), removeService);

export default router;
