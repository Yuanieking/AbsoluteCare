import jwt from "jsonwebtoken";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { JWT_SECRET } from "../config/env.js";
import User from "../models/userModel.js";
import type { AuthUser } from "../types/api.js";

export const protectRoute = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = req.cookies.session;

    if (!session) {
      res.status(401).json({
        message: "Unauthorized: No token found",
      });
      return;
    }

    const decoded = jwt.verify(session, JWT_SECRET) as jwt.JwtPayload;

    req.user = decoded as unknown as AuthUser;
    req.user.userId = (decoded.userId || decoded.sub) as string;

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
    ].includes(requestPath as string);
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

export function requireRole(...roles: string[]): RequestHandler {
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
