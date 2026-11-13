import { createRateLimiter } from "./rateLimit.js";

/** Route-local limiter for the public verification endpoint (30 requests/min per IP). */
export const verifyRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 30,
  body: { status: "rate_limited" },
});
