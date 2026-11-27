import { Router } from "express";
import { protectRoute } from "../middleware/authMiddleware.js";
import { recordEditors } from "../controllers/recordEditorsController.js";

const router = Router();
router.use(protectRoute);
// ** PUT /:kind/:id - register or refresh an editor on a record.
router.put("/:kind/:id", recordEditors);
// ** DELETE /:kind/:id - leave a record editor session.
router.delete("/:kind/:id", recordEditors);
export default router;
