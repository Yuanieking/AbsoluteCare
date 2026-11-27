import { getIntegrationConfig } from "../config/runtimeConfig.js";
import {
  getSettings,
  isRecaptchaRequired,
} from "../services/settingsService.js";

const VERIFY_TIMEOUT_MS = 5_000;

const CONFIG_ERROR_CODES = new Set([
  "missing-input-secret",
  "invalid-input-secret",
]);

export const INVALID_KEY_MESSAGE =
  "Invalid Key. Google rejected this client ID and secret pair. Copy both again from the Google Cloud console.";

function invalidKey(res) {
  console.warn("recaptcha: invalid key (invalid-input-secret)");
  res.status(503).json({
    code: "RECAPTCHA_INVALID_KEY",
    message: INVALID_KEY_MESSAGE,
  });
}

function misconfigured(res, reason) {
  console.warn(`recaptcha: misconfigured (${reason})`);
  res.status(503).json({
    code: "RECAPTCHA_MISCONFIGURED",
    message:
      "CAPTCHA is not set up correctly (missing or invalid site key). Please contact the clinic.",
  });
}

export default async function verifyRecaptcha(req, res, next) {
  try {
    const required = isRecaptchaRequired(await getSettings());
    if (!required) {
      console.info("recaptcha: skipped (disabled)");
      next();
      return;
    }

    const token = String(req.body?.recaptchaToken || "").trim();
    if (!token) {
      res.status(400).json({
        code: "RECAPTCHA_FAILED",
        message: "Please complete the reCAPTCHA check.",
      });
      return;
    }

    const secret = getIntegrationConfig("RECAPTCHA_SECRET_KEY").trim();
    if (!secret) {
      misconfigured(res, "missing secret key");
      return;
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
            secret,
            response: token,
            remoteip: req.ip,
          }),
          signal: controller.signal,
        },
      );
      const result = await response.json();
      const errorCodes = Array.isArray(result["error-codes"])
        ? result["error-codes"]
        : [];
      if (errorCodes.includes("invalid-input-secret")) {
        invalidKey(res);
        return;
      }
      if (errorCodes.some((code) => CONFIG_ERROR_CODES.has(code))) {
        misconfigured(res, errorCodes.join(", "));
        return;
      }
      if (!response.ok || result.success !== true) {
        console.info("recaptcha: failed");
        res.status(400).json({
          code: "RECAPTCHA_FAILED",
          message: "Please complete the reCAPTCHA check.",
        });
        return;
      }
      console.info("recaptcha: verified");
      next();
      return;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    console.info("recaptcha: unavailable");
    res.status(503).json({
      code: "RECAPTCHA_UNAVAILABLE",
      message: "We couldn't verify you right now. Please try again.",
    });
  }
}
