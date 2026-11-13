import type { NextFunction, Request, Response } from "express";

/**
 * Minimal security headers for a JSON API. Deliberately omits CSP and
 * Cross-Origin-Resource-Policy: the SPA is served from another origin and the
 * dev email preview returns HTML, so those would change working behaviour.
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.set("Strict-Transport-Security", "max-age=15552000");
  }
  next();
}
