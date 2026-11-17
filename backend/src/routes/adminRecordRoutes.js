import { Router } from "express";
import {
  protectRoute,
  requireAccess,
  requirePermission,
  requireRole,
} from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
import {
  getPatient,
  getTherapist,
  updatePatient,
  updateTherapist,
  updateTherapistAvailability,
  updateTherapistSpecialization,
} from "../controllers/adminUserController.js";

const router = Router();
router.param("id", objectIdParam);
router.use(
  protectRoute,
  requireRole("admin", "secretary", "therapist"),
  requireAccess("patients"),
);
router.get("/patients/:id", getPatient);
// ** Concurrency: every PATCH below accepts If-Match: "<user.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /patients/:id - edit a patient record.
router.patch(
  "/patients/:id",
  requirePermission("patients", "update"),
  updatePatient,
);
router.get("/therapists/:id", getTherapist);
// ** PATCH /therapists/:id - edit a therapist record.
router.patch(
  "/therapists/:id",
  requirePermission("patients", "update"),
  updateTherapist,
);
// ** PATCH /therapists/:id/specialization - replace specializations.
router.patch(
  "/therapists/:id/specialization",
  requirePermission("patients", "update"),
  updateTherapistSpecialization,
);
// ** PATCH /therapists/:id/working-days|working-hours - replace availability.
router.patch(
  "/therapists/:id/working-days",
  requirePermission("patients", "update"),
  updateTherapistAvailability,
);
router.patch(
  "/therapists/:id/working-hours",
  requirePermission("patients", "update"),
  updateTherapistAvailability,
);

export default router;
