import { createRateLimiter } from "./rateLimit.js";

export const verifyRateLimit = createRateLimiter({
  windowMs: 60_000,
  limit: 30,
  body: { status: "rate_limited" },
});
