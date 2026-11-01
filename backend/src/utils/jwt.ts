import jwt from "jsonwebtoken";
import type { Response } from "express";
import { JWT_SECRET } from "../config/env.js";
import { cookieOptions, jwtOptions } from "../config/jwtOptions.js";

export const generateToken = (userId: string, res: Response): void => {
  const payload = jwt.sign({ userId }, JWT_SECRET, jwtOptions);

  res.cookie("session", payload, cookieOptions);
};
