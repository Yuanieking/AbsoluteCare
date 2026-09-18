import { Router } from "express";
import {
  completeGoogleSignup,
  googleCallback,
  googleSession,
  googleStart,
  signup,
  login,
  logout,
  checkAuth,
  changePassword,
  forgotPassword,
  resetPassword,
  updateProfile,
  updateNotificationPreferences,
} from "../controller/authController.js";
import { protectRoute } from "../middleware/authMiddleware.js";
import verifyRecaptcha from "../middleware/verifyRecaptcha.js";

const router = Router();

router.post("/signup", verifyRecaptcha, signup);
router.post("/register", verifyRecaptcha, signup);
router.post("/login", verifyRecaptcha, login);
router.post("/logout", logout);
router.post("/forgot-password", verifyRecaptcha, forgotPassword);
router.post("/reset-password", resetPassword);
router.patch("/change-password", protectRoute, changePassword);
router.get("/google", googleStart);
router.get("/google/callback", googleCallback);
router.get("/google/session", googleSession);
router.post("/google/complete", completeGoogleSignup);

router.get("/me", protectRoute, checkAuth);
router.patch("/profile", protectRoute, updateProfile);
router.patch(
  "/notification-preferences",
  protectRoute,
  updateNotificationPreferences,
);

export default router;
