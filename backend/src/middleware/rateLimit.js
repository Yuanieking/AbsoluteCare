/**
 * In-memory, per-IP fixed-window limiter. Kept dependency-free on purpose; each
 * limiter owns its own counters so one route's traffic never eats another's.
 * With `failuresOnly`, a request is refunded when it finishes below 400, so only
 * failed attempts (bad password, invalid token) spend the budget.
 */
export function createRateLimiter({
  windowMs,
  limit,
  body,
  failuresOnly = false,
}) {
  const hits = new Map();
  const retryAfter = String(Math.ceil(windowMs / 1000));

  function refundOnSuccess(res, entry) {
    if (!failuresOnly) return;
    res.on("finish", () => {
      if (res.statusCode < 400 && entry.count > 0) entry.count -= 1;
    });
  }

  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      hits.set(key, fresh);
      if (hits.size > 10_000) {
        for (const [address, value] of hits) {
          if (value.resetAt <= now) hits.delete(address);
        }
      }
      refundOnSuccess(res, fresh);
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
    refundOnSuccess(res, entry);
    next();
  };
}

/**
 * Broad per-IP ceiling for the whole API. One staff page view costs 4-8 calls
 * (session, settings, notifications, data) and a clinic shares one public IP,
 * so the ceiling sits well above busy real use (~3 requests/second sustained).
 */
export const globalRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 1000,
  body: {
    message: "Too many requests. Please slow down and try again shortly.",
  },
});

/** Stricter ceiling for signup and password-reset endpoints; every request counts. */
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 15,
  body: {
    message: "Too many attempts. Please wait a few minutes and try again.",
  },
});

/** Login: only failed attempts count, so signing in and out never locks a user out. */
export const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 15,
  failuresOnly: true,
  body: {
    message: "Too many attempts. Please wait a few minutes and try again.",
  },
});
