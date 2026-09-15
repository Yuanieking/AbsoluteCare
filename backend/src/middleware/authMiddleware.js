import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import User from "../models/userModel.js";

export const protectRoute = async (req, res, next) => {
  try {
    const session = req.cookies.session;

    if (!session) {
      return res.status(401).json({
        message: "Unauthorized: No token found",
      });
    }

    const decoded = jwt.verify(session, JWT_SECRET);

    req.user = decoded;
    req.user.userId = decoded.userId || decoded.sub;

    if (!req.user.userId) {
      return res.status(401).json({
        message: "Unauthorized: Invalid session identity",
      });
    }

    const user = await User.findById(req.user.userId).select(
      "role isActive isArchived removedAt mustChangePassword",
    );
    if (!user || user.removedAt) {
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

    const requestPath = req.originalUrl.split("?")[0];
    const allowedDuringPasswordChange = [
      "/auth/me",
      "/auth/change-password",
      "/auth/logout",
    ].includes(requestPath);
    if (user.mustChangePassword && !allowedDuringPasswordChange) {
      return res.status(403).json({
        message: "Change your temporary password before continuing.",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
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
      return res.status(403).json({
        message: "This account no longer exists.",
      });
    }
    if (user && !user.isActive) {
      return res.status(403).json({
        message:
          "Your account has been deactivated. Contact the clinic administrator.",
      });
    }
    if (!user || !roles.includes(user.role)) {
      return res
        .status(403)
        .json({ message: "You do not have access to this workspace." });
    }
    req.user.role = user.role;
    next();
  };
}
