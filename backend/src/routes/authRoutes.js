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
} from "../controllers/authController.js";
import { protectRoute } from "../middleware/authMiddleware.js";
import verifyRecaptcha from "../middleware/verifyRecaptcha.js";
import { authRateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.post("/signup", authRateLimit, verifyRecaptcha, signup);
router.post("/register", authRateLimit, verifyRecaptcha, signup);
router.post("/login", authRateLimit, verifyRecaptcha, login);
router.post("/logout", logout);
router.post("/forgot-password", authRateLimit, verifyRecaptcha, forgotPassword);
router.post("/reset-password", authRateLimit, resetPassword);
// ** PATCH /change-password - set a new password. If-Match: "<user.updatedAt>" -> 409 when stale.
router.patch("/change-password", protectRoute, changePassword);
router.get("/google", googleStart);
router.get("/google/callback", googleCallback);
router.get("/google/session", googleSession);
router.post("/google/complete", verifyRecaptcha, completeGoogleSignup);

router.get("/me", protectRoute, checkAuth);
// ** Concurrency: If-Match: "<user.updatedAt>" -> 409 STALE_RECORD when stale.
// ** PATCH /profile - update own profile.
router.patch("/profile", protectRoute, updateProfile);
// ** PATCH /notification-preferences - update own notification toggles.
router.patch(
  "/notification-preferences",
  protectRoute,
  updateNotificationPreferences,
);

export default router;
