import { Router } from "express";
import { protectRoute, requireRole } from "../middleware/authMiddleware.js";
import {
  listSpecializations,
  registerSpecializations,
} from "../controllers/adminSpecializationController.js";

const router = Router();
router.use(protectRoute, requireRole("admin"));
// ** GET / - every specialization an admin can assign (catalog + assigned values).
router.get("/", listSpecializations);
// ** POST / - add names to the catalog (idempotent, case-insensitive).
router.post("/", registerSpecializations);

export default router;
