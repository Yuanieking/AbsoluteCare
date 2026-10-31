import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  getPatient,
  getTherapist,
  updatePatient,
  updateTherapist,
  updateTherapistAvailability,
  updateTherapistSpecialization,
} from "../controller/adminUserController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
router.get("/patients/:id", getPatient);
router.patch("/patients/:id", updatePatient);
router.get("/therapists/:id", getTherapist);
router.patch("/therapists/:id", updateTherapist);
router.patch("/therapists/:id/specialization", updateTherapistSpecialization);
router.patch("/therapists/:id/working-days", updateTherapistAvailability);
router.patch("/therapists/:id/working-hours", updateTherapistAvailability);

export default router;
