import {
  createUser,
  findActiveUserByEmail,
  findUserByEmail,
  findUserById,
  findUserByResetToken,
  saveUser,
  updateUserProfile,
  userHasDependents,
} from "../services/authService.js";
import {
  loginSchema,
  changePasswordSchema,
  profileUpdateSchema,
  signupSchema,
} from "../schemas/authSchema.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { FRONTEND_URL, JWT_SECRET } from "../config/env.js";
import { getIntegrationConfig } from "../config/runtimeConfig.js";
import { generateToken } from "../utils/jwt.js";
import { AppError } from "../errors/AppError.js";
import { guardFresh } from "../services/concurrencyService.js";
import { isValidEmail, normalizeEmail } from "../utils/validators.js";
import { passwordResetEmail, sendEmail } from "../services/mailer.js";
import {
  ensureBootstrapAdmin,
  isBootstrapAdminEmail,
} from "../services/adminBootstrapService.js";
import { passwordChanged as renderPasswordChanged } from "../emails/templates/index.js";
import {
  effectiveIntegrationEnabled,
  getSettings,
} from "../services/settingsService.js";

const googleScopes = "openid email profile";

const PENDING_APPROVAL_MESSAGE =
  "Your staff account is pending admin approval. Contact the clinic administrator.";
const DEACTIVATED_MESSAGE =
  "Your account has been deactivated. Contact the clinic administrator.";

const NOTIFICATION_CATEGORIES = ["appointmentUpdates", "reminders", "system"];

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isZodFailure(error) {
  return (
    error instanceof Error && error.name === "ZodError" && "errors" in error
  );
}

function passwordMinLength(settings) {
  return settings?.auth?.passwordMinLength || 8;
}

function isPendingApproval(user) {
  if (
    !user ||
    user.role === "user" ||
    user.isActive ||
    user.isArchived ||
    user.removedAt
  )
    return false;
  const audit = user.accountAudit || [];
  return !audit.some((entry) => entry.action === "activated");
}

function inactiveMessage(user) {
  return isPendingApproval(user)
    ? PENDING_APPROVAL_MESSAGE
    : DEACTIVATED_MESSAGE;
}

function googleConfig() {
  return {
    clientId: getIntegrationConfig("GOOGLE_CLIENT_ID"),
    clientSecret: getIntegrationConfig("GOOGLE_CLIENT_SECRET"),
    redirectUri: getIntegrationConfig("GOOGLE_REDIRECT_URI"),
  };
}

function requireOAuthConfig(config = googleConfig()) {
  if (!config.clientId || !config.clientSecret || !JWT_SECRET) {
    throw new Error("Google OAuth is not configured on the server.");
  }
  return config;
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

const GOOGLE_PICTURE_HOST = /googleusercontent\.com\//i;

/**
 * Adopts the Google avatar when the account has none, and refreshes one that
 * was previously synced from Google. A picture the person uploaded themselves
 * is left untouched.
 */
function shouldSyncGooglePicture(current, picture) {
  if (!current) return true;
  if (current === picture) return false;
  return GOOGLE_PICTURE_HOST.test(current);
}

export async function googleStart(req, res) {
  try {
    if (!effectiveIntegrationEnabled(await getSettings(), "googleAuth")) {
      res
        .status(403)
        .json({ message: "Google sign-in is currently disabled." });
      return;
    }
    const google = requireOAuthConfig();
    const state = crypto.randomBytes(24).toString("hex");
    setOAuthStateCookie(res, state);
    const params = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      response_type: "code",
      scope: googleScopes,
      state,
      access_type: "online",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (error) {
    res.redirect(
      googleRedirect(
        `/login?oauthError=${encodeURIComponent(errorMessage(error))}`,
      ),
    );
  }
}

export async function googleCallback(req, res) {
  try {
    if (!effectiveIntegrationEnabled(await getSettings(), "googleAuth")) {
      res
        .status(403)
        .json({ message: "Google sign-in is currently disabled." });
      return;
    }
    const google = requireOAuthConfig();
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
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.redirectUri,
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
    // Allowlisted addresses resolve to an active admin even before their first
    // Google sign-in, and re-enforce the role on every sign-in.
    const user = isBootstrapAdminEmail(email)
      ? await ensureBootstrapAdmin(email)
      : await findUserByEmail(email);
    if (user) {
      if (user.removedAt) {
        throw new Error("This account no longer exists.");
      }
      if (!user.isActive) {
        throw new Error(inactiveMessage(user));
      }
      const googlePicture = (profile.picture || "").trim();
      if (
        googlePicture &&
        shouldSyncGooglePicture(user.profilePicture, googlePicture)
      ) {
        user.profilePicture = googlePicture;
        await saveUser(user);
      }
      generateToken(user._id.toString(), res);
      const token = signAuthToken(user);
      res.redirect(
        googleRedirect(`/auth/callback?token=${encodeURIComponent(token)}`),
      );
      return;
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
    res.redirect(
      googleRedirect(`/google/setup?token=${encodeURIComponent(setupToken)}`),
    );
  } catch (error) {
    res.redirect(
      googleRedirect(
        `/login?oauthError=${encodeURIComponent(errorMessage(error))}`,
      ),
    );
  }
}

export async function googleSession(req, res) {
  try {
    if (!effectiveIntegrationEnabled(await getSettings(), "googleAuth")) {
      res
        .status(403)
        .json({ message: "Google sign-in is currently disabled." });
      return;
    }
    requireOAuthConfig();
    const token = req.headers.authorization?.replace("Bearer ", "");
    const payload = jwt.verify(token || "", JWT_SECRET);
    const user = await findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ message: "Account not found." });
      return;
    }
    if (user.removedAt) {
      res.status(403).json({ message: "This account no longer exists." });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ message: inactiveMessage(user) });
      return;
    }
    res.json({ user: user.omitPassword() });
  } catch {
    res.status(401).json({ message: "Google session is invalid or expired." });
  }
}

export async function completeGoogleSignup(req, res) {
  try {
    const settings = await getSettings();
    if (!effectiveIntegrationEnabled(settings, "googleAuth")) {
      res
        .status(403)
        .json({ message: "Google sign-in is currently disabled." });
      return;
    }
    requireOAuthConfig();
    const payload = jwt.verify(req.body.token || "", JWT_SECRET);
    if (payload.purpose !== "google-signup") {
      res.status(400).json({ message: "Invalid Google account setup." });
      return;
    }
    const firstName = String(
      req.body.firstName || payload.firstname || "",
    ).trim();
    const lastName = String(req.body.lastName || payload.lastname || "").trim();
    if (!firstName || !lastName) {
      res.status(400).json({ message: "First and last name are required." });
      return;
    }
    const suppliedPassword = String(req.body.password || "");
    let hashedPassword;
    if (suppliedPassword) {
      const minLength = passwordMinLength(settings);
      if (
        suppliedPassword.length < minLength ||
        suppliedPassword !== req.body.confirmPassword
      ) {
        res.status(400).json({
          message: `Passwords must match and be at least ${minLength} characters.`,
        });
        return;
      }
      hashedPassword = await bcrypt.hash(
        suppliedPassword,
        await bcrypt.genSalt(10),
      );
    } else {
      // Passwordless Google account: unguessable random hash; password can be set later.
      hashedPassword = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        10,
      );
    }
    if (!req.body.terms) {
      res
        .status(400)
        .json({ message: "Accept the terms before creating your account." });
      return;
    }
    const existingUser = await findUserByEmail(payload.email);
    if (existingUser) {
      res.status(409).json({
        message: "An account with this email address already exists.",
      });
      return;
    }
    const user = await createUser({
      firstname: firstName,
      lastname: lastName,
      email: payload.email,
      password: hashedPassword,
      profilePicture: payload.profilePicture || "",
      authProvider: "google",
      // Public signup is always a patient; only admins change roles.
      role: "user",
      isActive: true,
      acceptedTerms: true,
      termsAcceptedAt: new Date(),
      accountAudit: [{ action: "created" }],
    });
    generateToken(user._id.toString(), res);
    res
      .status(201)
      .json({ user: user.omitPassword(), token: signAuthToken(user) });
  } catch (error) {
    res.status(400).json({
      message: errorMessage(error) || "Unable to finish Google signup.",
    });
  }
}

export const signup = async (req, res) => {
  try {
    const settings = await getSettings();
    const body = signupSchema.parse(req.body);
    // Bootstrap admin addresses are Google-only, so a password signup can never
    // claim (and later be promoted into) an allowlisted admin account.
    if (isBootstrapAdminEmail(body.email)) {
      res.status(403).json({
        message:
          "This email address signs in with Google. Use Continue with Google instead.",
      });
      return;
    }
    if (!settings.auth.patientRegistrationEnabled) {
      res.status(403).json({
        message: "Registration is currently closed. Please contact the clinic.",
      });
      return;
    }
    const minLength = passwordMinLength(settings);
    if (String(body.password || "").length < minLength) {
      res.status(400).json({
        message: `Password must be at least ${minLength} characters.`,
      });
      return;
    }

    const existingUser = await findUserByEmail(body.email.toLowerCase());

    if (existingUser) {
      res.status(409).json({
        message: "An account with this email address already exists.",
      });
      return;
    }

    // ENCRYPTION
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(body.password, salt);

    const newUser = await createUser({
      firstname: body.firstName,
      lastname: body.lastName,
      email: body.email.toLowerCase(),
      password: hashPassword,
      authProvider: "local",
      phone: body.phone,
      // Public signup is always a patient; only admins change roles.
      role: "user",
      isActive: true,
      acceptedTerms: true,
      termsAcceptedAt: new Date(),
      accountAudit: [{ action: "created" }],
    });

    generateToken(newUser._id.toString(), res);

    res.status(201).json({
      message: "Account created successfully.",
      user: newUser.omitPassword(),
    });
  } catch (error) {
    if (isZodFailure(error)) {
      res.status(400).json({
        message: "Validation failed.",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({
      message: errorMessage(error) || "Internal server error.",
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
  if (!isValidEmail(email)) {
    res.status(404).json({
      code: "ACCOUNT_NOT_FOUND",
      message: "No account was found with that email address.",
    });
    return;
  }

  const user = await findActiveUserByEmail(email);
  if (!user) {
    res.status(404).json({
      code: "ACCOUNT_NOT_FOUND",
      message: "No account was found with that email address.",
    });
    return;
  }

  const key = resetRateKey(req, email);
  const now = Date.now();
  const attempts = (resetAttempts.get(key) || []).filter(
    (timestamp) => now - timestamp < 60 * 60 * 1000,
  );
  if (attempts.length >= 5) {
    res.status(200).json({ message: successMessage });
    return;
  }
  attempts.push(now);
  resetAttempts.set(key, attempts);

  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordTokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  user.resetPasswordExpiresAt = new Date(now + 30 * 60 * 1000);
  await saveUser(user);
  void passwordResetEmail({
    email: user.email,
    token,
    staff: user.role !== "user",
  })
    .then(sendEmail)
    .catch((error) =>
      console.error(
        "Password reset email rendering failed:",
        errorMessage(error),
      ),
    );
  res.status(200).json({ message: successMessage });
};

export const resetPassword = async (req, res) => {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  const minLength = passwordMinLength(await getSettings());
  if (token.length < 32 || password.length < minLength) {
    res.status(400).json({ message: "Invalid reset request." });
    return;
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await findUserByResetToken(tokenHash);
  if (!user) {
    res.status(400).json({ message: "This reset link is invalid or expired." });
    return;
  }
  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordTokenHash = "";
  user.resetPasswordExpiresAt = null;
  await saveUser(user);
  void renderPasswordChanged({
    email: user.email,
    changedAt: new Date(),
    phone: "",
  })
    .then(sendEmail)
    .catch((error) =>
      console.error(
        "Password changed email rendering failed:",
        errorMessage(error),
      ),
    );
  res.json({ message: "Password updated successfully." });
};

export const login = async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await findUserByEmail(body.email.toLowerCase());
    if (!user) {
      res.status(401).json({
        message: "Invalid email or password.",
      });
      return;
    }

    if (user.removedAt) {
      res.status(403).json({
        message: "This account no longer exists.",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: inactiveMessage(user) });
      return;
    }

    const isMatch = await bcrypt.compare(body.password, user.password || "");
    if (!isMatch) {
      res.status(401).json({
        message: "Invalid email or password.",
      });
      return;
    }

    generateToken(user._id.toString(), res);

    res.status(200).json({
      message: "Login successful.",
      user: user.omitPassword(),
    });
  } catch (error) {
    if (isZodFailure(error)) {
      res.status(400).json({
        message: "Validation failed.",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({
      message: errorMessage(error) || "Internal server error.",
    });
  }
};

export const checkAuth = async (req, res) => {
  const user = await findUserById(req.user.userId);
  if (!user) {
    res.status(401).json({ message: "Account not found." });
    return;
  }
  const hasDependents = await userHasDependents(user._id.toString());
  res.status(200).json({
    user: { ...user.omitPassword(), isGuardian: hasDependents },
  });
};

export const updateProfile = async (req, res) => {
  try {
    const body = profileUpdateSchema.parse(req.body);
    const user = await updateUserProfile(
      req.user.userId,
      body,
      req.get("If-Match"),
    );

    if (!user) {
      res.status(404).json({ message: "Account not found." });
      return;
    }
    res.status(200).json({ user: user.omitPassword() });
  } catch (error) {
    // ** Concurrency: let 409 STALE_RECORD reach the global handler instead of a 500.
    if (error instanceof AppError) throw error;
    if (isZodFailure(error)) {
      res.status(400).json({
        message: "Please correct the highlighted profile fields.",
        errors: error.errors,
      });
      return;
    }
    res.status(500).json({ message: "Unable to update your profile." });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  const user = await findUserById(req.user.userId);
  if (!user) {
    res.status(404).json({ message: "Account not found." });
    return;
  }
  // ** Concurrency: reject if the account changed since the client read it.
  guardFresh(user, req.get("If-Match"));
  if (typeof req.body.inApp === "boolean")
    user.notificationPreferences.inApp = req.body.inApp;
  if (typeof req.body.email === "boolean")
    user.notificationPreferences.email = req.body.email;
  for (const category of NOTIFICATION_CATEGORIES) {
    if (!req.body[category]) continue;
    if (typeof req.body[category].inApp === "boolean")
      user.notificationPreferences[category].inApp = req.body[category].inApp;
    if (typeof req.body[category].email === "boolean")
      user.notificationPreferences[category].email = req.body[category].email;
  }
  await saveUser(user);
  res.json({ user: user.omitPassword() });
};

export const logout = (req, res) => {
  res.clearCookie("session");
  res.status(204).send();
};

export const changePassword = async (req, res) => {
  const parsed = changePasswordSchema.parse(req.body);
  const minLength = passwordMinLength(await getSettings());
  if (String(parsed.password || "").length < minLength) {
    res.status(400).json({
      message: `Password must be at least ${minLength} characters.`,
    });
    return;
  }
  const user = await findUserById(req.user.userId);
  if (!user) {
    res.status(404).json({ message: "Account not found." });
    return;
  }
  // ** Concurrency: reject if the account changed since the client read it.
  guardFresh(user, req.get("If-Match"));
  user.password = await bcrypt.hash(parsed.password, 10);
  user.mustChangePassword = false;
  // First password change doubles as Terms acceptance for staff-provisioned
  // accounts that never accepted them at signup.
  if (!user.acceptedTerms) {
    user.acceptedTerms = true;
    user.termsAcceptedAt = new Date();
  }
  await saveUser(user);
  res.json({
    user: user.omitPassword(),
    message: "Password changed successfully.",
  });
};
