import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  archiveUser,
  activateUser,
  createUser,
  deactivateUser,
  getUser,
  getPatient,
  getTherapist,
  listUsers,
  removeUser,
  updatePatient,
  updateTherapist,
  updateTherapistAvailability,
  updateTherapistSpecialization,
  updateUser,
} from "../controller/adminUserController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
router.get("/", listUsers);
router.post("/", createUser);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.patch("/:id/archive", archiveUser);
router.patch("/:id/activate", activateUser);
router.patch("/:id/deactivate", deactivateUser);
router.delete("/:id", removeUser);
router.get("/patients/:id", getPatient);
router.patch("/patients/:id", updatePatient);
router.get("/therapists/:id", getTherapist);
router.patch("/therapists/:id", updateTherapist);
router.patch("/therapists/:id/specialization", updateTherapistSpecialization);
router.patch("/therapists/:id/working-days", updateTherapistAvailability);
router.patch("/therapists/:id/working-hours", updateTherapistAvailability);

export default router;
