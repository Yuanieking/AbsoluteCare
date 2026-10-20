import User from "../models/userModel.js";
import Dependent from "../models/dependentModel.js";
import {
  loginSchema,
  changePasswordSchema,
  profileUpdateSchema,
  signupSchema,
} from "../schema/authSchema.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  FRONTEND_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SECRET_KEY,
  JWT_SECRET,
} from "../config/env.js";
import { generateToken } from "../utils/jwt.js";
import { isValidEmail, normalizeEmail } from "../utils/validators.js";
import { passwordResetEmail, sendEmail } from "../services/mailer.js";
import { passwordChanged as renderPasswordChanged } from "../emails/templates/index.js";
import {
  effectiveIntegrationEnabled,
  getSettings,
} from "../services/settingsService.js";

const googleScopes = "openid email profile";

function requireOAuthConfig() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
    throw new Error("Google OAuth is not configured on the server.");
  }
}

function signAuthToken(user) {
  requireOAuthConfig();
  return jwt.sign({ sub: user._id.toString() }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

function readCookie(request, name) {
  const cookies = request.headers.cookie || "";
  const value = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : "";
}

function setOAuthStateCookie(response, value, maxAge = 600) {
  response.setHeader(
    "Set-Cookie",
    `google_oauth_state=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/auth/google; Max-Age=${maxAge}`,
  );
}

function googleRedirect(path) {
  return `${FRONTEND_URL}${path}`;
}

export async function googleStart(req, res) {
  try {
    if (!effectiveIntegrationEnabled(await getSettings(), "googleAuth")) {
      return res
        .status(403)
        .json({ message: "Google sign-in is currently disabled." });
    }
    requireOAuthConfig();
    const state = crypto.randomBytes(24).toString("hex");
    setOAuthStateCookie(res, state);
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: googleScopes,
      state,
      access_type: "online",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (error) {
    res.redirect(
      googleRedirect(`/login?oauthError=${encodeURIComponent(error.message)}`),
    );
  }
}

export async function googleCallback(req, res) {
  try {
    if (!effectiveIntegrationEnabled(await getSettings(), "googleAuth")) {
      return res
        .status(403)
        .json({ message: "Google sign-in is currently disabled." });
    }
    requireOAuthConfig();
    const stateCookie = readCookie(req, "google_oauth_state");
    setOAuthStateCookie(res, "", 0);
    if (!stateCookie || stateCookie !== req.query.state) {
      throw new Error("Invalid Google OAuth state.");
    }
    if (!req.query.code)
      throw new Error("Google did not return an authorization code.");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error("Google authorization failed.");
    }

    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email || !profile.email_verified) {
      throw new Error("Google did not return a verified email address.");
    }

    const email = profile.email.toLowerCase();
    const user = await User.findOne({ email });
    if (user) {
      generateToken(user._id.toString(), res);
      const token = signAuthToken(user);
      return res.redirect(
        googleRedirect(`/auth/callback?token=${encodeURIComponent(token)}`),
      );
    }

    const setupToken = jwt.sign(
      {
        purpose: "google-signup",
        email,
        firstname: profile.given_name || "",
        lastname: profile.family_name || "",
        profilePicture: profile.picture || "",
      },
      JWT_SECRET,
      { expiresIn: "10m" },
    );
    return res.redirect(
      googleRedirect(`/google/setup?token=${encodeURIComponent(setupToken)}`),
    );
  } catch (error) {
    return res.redirect(
      googleRedirect(`/login?oauthError=${encodeURIComponent(error.message)}`),
    );
  }
}

export async function googleSession(req, res) {
  try {
    if (!effectiveIntegrationEnabled(await getSettings(), "googleAuth")) {
      return res
        .status(403)
        .json({ message: "Google sign-in is currently disabled." });
    }
    requireOAuthConfig();
    const token = req.headers.authorization?.replace("Bearer ", "");
    const payload = jwt.verify(token || "", JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Account not found." });
    return res.json({ user: user.omitPassword() });
  } catch {
    return res
      .status(401)
      .json({ message: "Google session is invalid or expired." });
  }
}

export async function completeGoogleSignup(req, res) {
  try {
    if (!effectiveIntegrationEnabled(await getSettings(), "googleAuth")) {
      return res
        .status(403)
        .json({ message: "Google sign-in is currently disabled." });
    }
    requireOAuthConfig();
    const payload = jwt.verify(req.body.token || "", JWT_SECRET);
    if (payload.purpose !== "google-signup") {
      return res.status(400).json({ message: "Invalid Google account setup." });
    }
    const firstName = String(
      req.body.firstName || payload.firstname || "",
    ).trim();
    const lastName = String(req.body.lastName || payload.lastname || "").trim();
    if (!firstName || !lastName) {
      return res
        .status(400)
        .json({ message: "First and last name are required." });
    }
    const password = String(req.body.password || "");
    if (password.length < 8 || password !== req.body.confirmPassword) {
      return res.status(400).json({
        message: "Passwords must match and be at least 8 characters.",
      });
    }
    if (!req.body.terms) {
      return res
        .status(400)
        .json({ message: "Accept the terms before creating your account." });
    }
    const existingUser = await User.findOne({ email: payload.email });
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email address already exists.",
      });
    }
    const hashedPassword = await bcrypt.hash(
      password,
      await bcrypt.genSalt(10),
    );
    const user = await User.create({
      firstname: firstName,
      lastname: lastName,
      email: payload.email,
      password: hashedPassword,
      profilePicture: payload.profilePicture || "",
      authProvider: "google",
      acceptedTerms: true,
      termsAcceptedAt: new Date(),
    });
    generateToken(user._id.toString(), res);
    return res
      .status(201)
      .json({ user: user.omitPassword(), token: signAuthToken(user) });
  } catch (error) {
    return res
      .status(400)
      .json({ message: error.message || "Unable to finish Google signup." });
  }
}

export const signup = async (req, res) => {
  try {
    if (!(await getSettings()).auth.patientRegistrationEnabled) {
      return res.status(403).json({
        message: "Registration is currently closed. Please contact the clinic.",
      });
    }
    const body = signupSchema.parse(req.body);

    const existingUser = await User.findOne({
      email: body.email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email address already exists.",
      });
    }

    // ENCRYPTION
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(body.password, salt);

    const newUser = new User({
      firstname: body.firstName,
      lastname: body.lastName,
      email: body.email.toLowerCase(),
      password: hashPassword,
      authProvider: "local",
      phone: body.phone,
      acceptedTerms: true,
      termsAcceptedAt: new Date(),
    });

    await newUser.save();

    return res.status(201).json({
      message: "Account created successfully.",
      user: newUser.omitPassword(),
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed.",
        errors: error.errors,
      });
    }
    return res.status(500).json({
      message: error.message || "Internal server error.",
    });
  }
};

const resetAttempts = new Map();

function resetRateKey(req, email) {
  return `${req.ip}:${email}`;
}

export const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const successMessage =
    "If an account exists with this email, a reset link has been sent.";
  if (!isValidEmail(email))
    return res.status(404).json({
      code: "ACCOUNT_NOT_FOUND",
      message: "No account was found with that email address.",
    });

  const user = await User.findOne({ email, isActive: true, removedAt: null });
  if (!user) {
    return res.status(404).json({
      code: "ACCOUNT_NOT_FOUND",
      message: "No account was found with that email address.",
    });
  }

  const key = resetRateKey(req, email);
  const now = Date.now();
  const attempts = (resetAttempts.get(key) || []).filter(
    (timestamp) => now - timestamp < 60 * 60 * 1000,
  );
  if (attempts.length >= 5)
    return res.status(200).json({ message: successMessage });
  attempts.push(now);
  resetAttempts.set(key, attempts);

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordTokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  user.resetPasswordExpiresAt = new Date(now + 30 * 60 * 1000);
  await user.save();
  void passwordResetEmail({
    email: user.email,
    token,
    staff: user.role !== "user",
  })
    .then(sendEmail)
    .catch((error) =>
      console.error("Password reset email rendering failed:", error.message),
    );
  return res.status(200).json({ message: successMessage });
};

export const resetPassword = async (req, res) => {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (token.length < 32 || password.length < 8) {
    return res.status(400).json({ message: "Invalid reset request." });
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: new Date() },
    isActive: true,
    removedAt: null,
  });
  if (!user)
    return res
      .status(400)
      .json({ message: "This reset link is invalid or expired." });
  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordTokenHash = "";
  user.resetPasswordExpiresAt = null;
  await user.save();
  void renderPasswordChanged({
    email: user.email,
    changedAt: new Date(),
    phone: "",
  })
    .then(sendEmail)
    .catch((error) =>
      console.error("Password changed email rendering failed:", error.message),
    );
  return res.json({ message: "Password updated successfully." });
};

export const login = async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await User.findOne({ email: body.email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (user.removedAt) {
      return res.status(403).json({
        message: "This account no longer exists.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "Your account has been deactivated. Contact the clinic administrator.",
      });
    }

    const isMatch = await bcrypt.compare(body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    generateToken(user._id.toString(), res);

    return res.status(200).json({
      message: "Login successful.",
      user: user.omitPassword(),
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed.",
        errors: error.errors,
      });
    }
    return res.status(500).json({
      message: error.message || "Internal server error.",
    });
  }
};

export const checkAuth = async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(401).json({ message: "Account not found." });
  const hasDependents = await Dependent.exists({
    guardian: user._id,
    isActive: true,
  });
  res.status(200).json({
    user: { ...user.omitPassword(), isGuardian: Boolean(hasDependents) },
  });
};

export const updateProfile = async (req, res) => {
  try {
    const body = profileUpdateSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        firstname: body.firstName,
        lastname: body.lastName,
        phone: body.phone,
        dateOfBirth: body.dateOfBirth,
        address: body.address,
        profilePicture: body.profilePicture,
      },
      { new: true, runValidators: true },
    );

    if (!user) return res.status(404).json({ message: "Account not found." });
    return res.status(200).json({ user: user.omitPassword() });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Please correct the highlighted profile fields.",
        errors: error.errors,
      });
    }
    return res.status(500).json({ message: "Unable to update your profile." });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ message: "Account not found." });
  if (typeof req.body.inApp === "boolean")
    user.notificationPreferences.inApp = req.body.inApp;
  if (typeof req.body.email === "boolean")
    user.notificationPreferences.email = req.body.email;
  for (const category of ["appointmentUpdates", "reminders", "system"]) {
    if (!req.body[category]) continue;
    if (typeof req.body[category].inApp === "boolean")
      user.notificationPreferences[category].inApp = req.body[category].inApp;
    if (typeof req.body[category].email === "boolean")
      user.notificationPreferences[category].email = req.body[category].email;
  }
  await user.save();
  res.json({ user: user.omitPassword() });
};

export const logout = (req, res) => {
  res.clearCookie("session");
  res.status(204).send();
};

export const changePassword = async (req, res) => {
  const parsed = changePasswordSchema.parse(req.body);
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ message: "Account not found." });
  user.password = await bcrypt.hash(parsed.password, 10);
  user.mustChangePassword = false;
  await user.save();
  res.json({
    user: user.omitPassword(),
    message: "Password changed successfully.",
  });
};
