import { Router } from "express";
import { protectRoute } from "../middleware/authMiddleware.js";
import { recordEditors } from "../controllers/recordEditorsController.js";

const router = Router();
router.use(protectRoute);
router.put("/:kind/:id", recordEditors);
router.delete("/:kind/:id", recordEditors);
export default router;
