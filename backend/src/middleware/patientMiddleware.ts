import type { NextFunction, Request, Response } from "express";
import User from "../models/userModel.js";

export const requirePatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const user = await User.findById(req.user.userId);

  if (!user || !["user", "patient"].includes(user.role)) {
    res.status(403).json({ message: "Patient access is required." });
    return;
  }

  req.patient = user;
  next();
};
