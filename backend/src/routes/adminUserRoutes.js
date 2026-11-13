import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
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
} from "../controllers/adminUserController.js";

const router = Router();
router.param("id", objectIdParam);
router.use(protectRoute, requireRole("admin"));
router.get("/", listUsers);
router.post("/", createUser);
router.get("/:id", getUser);
// ** Concurrency: every PATCH/DELETE below accepts If-Match: "<user.updatedAt>".
// ** A stale timestamp returns 409 { code: "STALE_RECORD" }; no header = unchecked.
// ** PATCH /:id - edit account fields / role.
router.patch("/:id", updateUser);
// ** PATCH /:id/archive - archive an account.
router.patch("/:id/archive", archiveUser);
// ** PATCH /:id/activate - re-activate an account.
router.patch("/:id/activate", activateUser);
// ** PATCH /:id/deactivate - deactivate an account.
router.patch("/:id/deactivate", deactivateUser);
// ** DELETE /:id - soft-remove an account (body.confirmName required).
router.delete("/:id", removeUser);
router.get("/patients/:id", getPatient);
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
