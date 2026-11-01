import type { NextFunction, Request, Response } from "express";
import { getIntegrationConfig } from "../config/runtimeConfig.js";
import {
  getSettings,
  isRecaptchaRequired,
} from "../services/settingsService.js";

const VERIFY_TIMEOUT_MS = 5_000;

export default async function verifyRecaptcha(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
      const response = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: getIntegrationConfig("RECAPTCHA_SECRET_KEY").trim(),
            response: token,
            remoteip: req.ip as string,
          }),
          signal: controller.signal,
        },
      );
      const result = (await response.json()) as { success?: boolean };
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
