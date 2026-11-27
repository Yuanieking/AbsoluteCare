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
import { authRateLimit, loginRateLimit } from "../middleware/rateLimit.js";

const router = Router();

// ** POST /signup - create a patient account.
router.post("/signup", authRateLimit, verifyRecaptcha, signup);
// ** POST /register - alias of /signup.
router.post("/register", authRateLimit, verifyRecaptcha, signup);
// ** POST /login - sign in.
router.post("/login", loginRateLimit, verifyRecaptcha, login);
// ** POST /logout - sign out.
router.post("/logout", logout);
// ** POST /forgot-password - send a password reset link.
router.post("/forgot-password", authRateLimit, verifyRecaptcha, forgotPassword);
// ** POST /reset-password - set a new password from a reset link.
router.post("/reset-password", authRateLimit, resetPassword);
// ** PATCH /change-password - set a new password. If-Match: "<user.updatedAt>" -> 409 when stale.
router.patch("/change-password", protectRoute, changePassword);
// ** GET /google - start Google sign-in.
router.get("/google", googleStart);
// ** GET /google/callback - Google OAuth redirect target.
router.get("/google/callback", googleCallback);
// ** GET /google/session - result of the Google sign-in.
router.get("/google/session", googleSession);
// ** POST /google/complete - finish a Google signup.
router.post("/google/complete", verifyRecaptcha, completeGoogleSignup);

// ** GET /me - current user.
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
