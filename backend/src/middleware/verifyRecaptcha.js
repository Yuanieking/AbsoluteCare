import { RECAPTCHA_SECRET_KEY } from "../config/env.js";
import {
  getSettings,
  isRecaptchaRequired,
} from "../services/settingsService.js";

const VERIFY_TIMEOUT_MS = 5_000;

export default async function verifyRecaptcha(req, res, next) {
  try {
    const required = isRecaptchaRequired(await getSettings());
    if (!required) {
      console.info("recaptcha: skipped (disabled)");
      return next();
    }

    const token = String(req.body?.recaptchaToken || "").trim();
    if (!token) {
      return res.status(400).json({
        code: "RECAPTCHA_FAILED",
        message: "Please complete the reCAPTCHA check.",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
      const response = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: RECAPTCHA_SECRET_KEY.trim(),
            response: token,
            remoteip: req.ip,
          }),
          signal: controller.signal,
        },
      );
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        console.info("recaptcha: failed");
        return res.status(400).json({
          code: "RECAPTCHA_FAILED",
          message: "Please complete the reCAPTCHA check.",
        });
      }
      console.info("recaptcha: verified");
      return next();
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    console.info("recaptcha: unavailable");
    return res.status(503).json({
      code: "RECAPTCHA_UNAVAILABLE",
      message: "We couldn't verify you right now. Please try again.",
    });
  }
}
