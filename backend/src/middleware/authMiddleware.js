import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../config/env.js";
import User from "../models/userModel.js";
import { getSettings, roleHasAccess } from "../services/settingsService.js";

export const protectRoute = async (req, res, next) => {
  try {
    const session = req.cookies.session;

    if (!session) {
      res.status(401).json({
        message: "Unauthorized: No token found",
      });
      return;
    }

    const decoded = jwt.verify(session, JWT_SECRET);

    req.user = decoded;
    req.user.userId = decoded.userId || decoded.sub;

    if (!req.user.userId) {
      res.status(401).json({
        message: "Unauthorized: Invalid session identity",
      });
      return;
    }

    const user = await User.findById(req.user.userId).select(
      "role isActive isArchived removedAt mustChangePassword",
    );
    if (!user || user.removedAt) {
      res.status(403).json({
        message: "This account no longer exists.",
      });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({
        message:
          "Your account is pending approval or has been deactivated. Contact the clinic administrator.",
      });
      return;
    }

    const requestPath = req.originalUrl.split("?")[0];
    const allowedDuringPasswordChange = [
      "/auth/me",
      "/auth/change-password",
      "/auth/logout",
    ].includes(requestPath);
    if (user.mustChangePassword && !allowedDuringPasswordChange) {
      res.status(403).json({
        message: "Change your temporary password before continuing.",
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({
      message: "Unauthorized: Invalid or expired token",
    });
  }
};

export function requireRole(...roles) {
  return async (req, res, next) => {
    const user = await User.findById(req.user.userId).select(
      "role isActive isArchived removedAt",
    );
    if (user?.removedAt) {
      res.status(403).json({
        message: "This account no longer exists.",
      });
      return;
    }
    if (user && !user.isActive) {
      res.status(403).json({
        message:
          "Your account is pending approval or has been deactivated. Contact the clinic administrator.",
      });
      return;
    }
    if (!user || !roles.includes(user.role)) {
      res
        .status(403)
        .json({ message: "You do not have access to this workspace." });
      return;
    }
    req.user.role = user.role;
    next();
  };
}

// Runs after requireRole: admins always pass, other staff roles pass only
// while the admin has switched the area on in Settings.
export function requireAccess(area) {
  return async (req, res, next) => {
    try {
      const settings = await getSettings();
      if (!roleHasAccess(settings, String(req.user.role), area)) {
        res.status(403).json({
          message: "Your role does not have access to this area.",
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
