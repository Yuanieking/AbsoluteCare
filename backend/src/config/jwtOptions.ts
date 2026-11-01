import type { CookieOptions } from "express";
import type { SignOptions } from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";

export const cookieOptions: CookieOptions = {
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
};

export const jwtOptions: SignOptions = {
  expiresIn: "1d",
};
