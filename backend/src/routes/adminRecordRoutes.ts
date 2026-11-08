import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  getPatient,
  getTherapist,
  updatePatient,
  updateTherapist,
  updateTherapistAvailability,
  updateTherapistSpecialization,
} from "../controllers/adminUserController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
router.get("/patients/:id", getPatient);
// ** Concurrency: every PATCH below accepts If-Match: "<user.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /patients/:id - edit a patient record.
router.patch("/patients/:id", updatePatient);
router.get("/therapists/:id", getTherapist);
// ** PATCH /therapists/:id - edit a therapist record.
router.patch("/therapists/:id", updateTherapist);
// ** PATCH /therapists/:id/specialization - replace specializations.
router.patch("/therapists/:id/specialization", updateTherapistSpecialization);
// ** PATCH /therapists/:id/working-days|working-hours - replace availability.
router.patch("/therapists/:id/working-days", updateTherapistAvailability);
router.patch("/therapists/:id/working-hours", updateTherapistAvailability);

export default router;
