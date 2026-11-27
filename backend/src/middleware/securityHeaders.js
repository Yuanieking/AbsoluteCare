export function securityHeaders(req, res, next) {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.set("Strict-Transport-Security", "max-age=15552000");
  }
  next();
}
