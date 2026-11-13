import type { NextFunction, Request, RequestHandler, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  /** JSON body sent with the 429 response. */
  body: Record<string, unknown>;
}

/**
 * In-memory, per-IP fixed-window limiter. Kept dependency-free on purpose; each
 * limiter owns its own counters so one route's traffic never eats another's.
 */
export function createRateLimiter({
  windowMs,
  limit,
  body,
}: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const retryAfter = String(Math.ceil(windowMs / 1000));

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10_000) {
        for (const [address, value] of hits) {
          if (value.resetAt <= now) hits.delete(address);
        }
      }
      next();
      return;
    }
    if (entry.count >= limit) {
      res.set("Retry-After", retryAfter);
      res.status(429).json(body);
      return;
    }
    entry.count += 1;
    next();
  };
}

/** Broad per-IP ceiling for the whole API; generous so normal use never hits it. */
export const globalRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 600,
  body: { message: "Too many requests. Please slow down and try again shortly." },
});

/** Stricter ceiling for credential endpoints (login, signup, password reset). */
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 50,
  body: {
    message: "Too many attempts. Please wait a few minutes and try again.",
  },
});
