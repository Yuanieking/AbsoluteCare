/**
 * In-memory, per-IP fixed-window limiter. Kept dependency-free on purpose; each
 * limiter owns its own counters so one route's traffic never eats another's.
 */
export function createRateLimiter({ windowMs, limit, body }) {
  const hits = new Map();
  const retryAfter = String(Math.ceil(windowMs / 1000));

  return (req, res, next) => {
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
      const remainingMinutes = Math.max(
        1,
        Math.ceil((entry.resetAt - now) / 60_000),
      );
      res.set("Retry-After", retryAfter);
      const message = body.message || "Too many requests.";
      res.status(429).json({
        ...body,
        message: `${message} Retry in ${remainingMinutes} minute(s).`,
      });
      return;
    }
    entry.count += 1;
    next();
  };
}

/** Broad per-IP ceiling for the whole API; generous so normal use never hits it. */
export const globalRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 100,
  body: {
    message: "Too many requests. Please slow down and try again shortly.",
  },
});

/** Stricter ceiling for credential endpoints (login, signup, password reset). */
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 5,
  body: {
    message: "Too many attempts. Please wait a few minutes and try again.",
  },
});
