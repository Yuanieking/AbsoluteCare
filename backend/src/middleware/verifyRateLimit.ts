import type { NextFunction, Request, RequestHandler, Response } from "express";

const WINDOW_MS = 60_000;
const LIMIT = 30;

const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Route-local limiter for the public verification endpoint. The app has no
 * global limiter, so this stays a few lines instead of a new dependency.
 */
export const verifyRateLimit: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const key = req.ip || "unknown";
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 10_000) {
      for (const [address, value] of hits) {
        if (value.resetAt <= now) hits.delete(address);
      }
    }
    next();
    return;
  }
  if (entry.count >= LIMIT) {
    res.set("Retry-After", "60");
    res.status(429).json({ status: "rate_limited" });
    return;
  }
  entry.count += 1;
  next();
};
