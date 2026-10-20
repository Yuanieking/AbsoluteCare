import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { cookieOptions, jwtOptions } from "../config/jwtOptions.js";

export const generateToken = (userId, res) => {
  const payload = jwt.sign({ userId }, JWT_SECRET, jwtOptions);

  res.cookie("session", payload, cookieOptions);
};
