import nodemailer from "nodemailer";
import {
  GMAIL_APP_PASSWORD,
  GMAIL_USER,
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_USER,
} from "../config/env.js";
import { resetPassword as renderResetPassword } from "../emails/templates/index.js";

const MAIL_TIMEOUT_MS = 10_000;
const RETRY_DELAYS = [250, 750];
const PLACEHOLDERS = ["changeme", "xxx", "replace-with", "your-"];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function usable(value) {
  const normalized = clean(value).toLowerCase();
  return (
    Boolean(normalized) &&
    !PLACEHOLDERS.some((item) => normalized.includes(item))
  );
}

function mailConfig() {
  const host = clean(process.env.SMTP_HOST) || clean(SMTP_HOST);
  const smtpUser = clean(process.env.SMTP_USER);
  const smtpPass = clean(process.env.SMTP_PASS || process.env.SMTP_PASSWORD);
  const gmailCredentials = usable(GMAIL_USER) && usable(GMAIL_APP_PASSWORD);
  const useGmailCredentials =
    /(^|\.)gmail\.com$/i.test(host) && gmailCredentials;
  const user = useGmailCredentials
    ? clean(GMAIL_USER)
    : smtpUser || clean(GMAIL_USER);
  const pass = useGmailCredentials
    ? clean(GMAIL_APP_PASSWORD)
    : smtpPass || clean(GMAIL_APP_PASSWORD);
  const port = Number(clean(process.env.SMTP_PORT) || SMTP_PORT || 465);
  const secureValue = clean(process.env.SMTP_SECURE);
  const secure = secureValue
    ? secureValue.toLowerCase() === "true"
    : port === 465;
  const from = clean(process.env.MAIL_FROM) || clean(MAIL_FROM);
  const missing = [];
  if (!usable(host)) missing.push("SMTP_HOST");
  if (!Number.isInteger(port) || port <= 0) missing.push("SMTP_PORT");
  if (!usable(user)) missing.push("SMTP_USER");
  if (!usable(pass)) missing.push("SMTP_PASS");
  if (!usable(from)) missing.push("MAIL_FROM");
  return {
    host,
    port,
    secure,
    user,
    pass: pass.replaceAll(" ", ""),
    from,
    missing,
  };
}

export function classifyMailError(error) {
  const code = String(
    error?.code || error?.responseCode || "MAIL_ERROR",
  ).toUpperCase();
  const responseCode = Number(error?.responseCode || error?.statusCode || 0);
  if (code === "EAUTH" || responseCode === 535) {
    return {
      code: "EAUTH",
      retryable: false,
      userMessage:
        "Gmail rejected the login. Use an App Password (2-Step Verification must be on), not the account password.",
    };
  }
  if (responseCode === 550 || responseCode === 553) {
    return {
      code: `SMTP_${responseCode}`,
      retryable: false,
      userMessage:
        "The email provider rejected the sender or recipient address.",
    };
  }
  if (
    code === "ECONNECTION" ||
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    (responseCode >= 400 && responseCode < 500)
  ) {
    return {
      code,
      retryable: true,
      userMessage:
        "The email provider is temporarily unavailable. Please try again.",
    };
  }
  if (code === "NOT_CONFIGURED") {
    const missing = Array.isArray(error?.missing)
      ? error.missing
      : ["SMTP_PASS"];
    return {
      code,
      retryable: false,
      userMessage: `Email isn't configured. Missing: ${missing
        .map((item) => `\`${item}\``)
        .join(", ")}.`,
    };
  }
  return {
    code,
    retryable: false,
    userMessage: "The email provider could not send this message.",
  };
}

export function createMailTransport(config = mailConfig()) {
  if (config.missing.length) return null;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
  });
}

const config = mailConfig();
const transport = createMailTransport(config);
let health = {
  configured: config.missing.length === 0,
  missing: config.missing,
  lastCheck: null,
  ok: null,
  userMessage: config.missing.length
    ? `Email isn't configured. Missing: ${config.missing.map((item) => `\`${item}\``).join(", ")}.`
    : "Email provider has not been checked yet.",
};

export function getMailerHealth() {
  return { ...health };
}

function updateHealth(result) {
  health = { ...health, ...result, lastCheck: new Date() };
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments = [],
  headers = {},
}) {
  if (!transport) {
    const userMessage = `Email isn't configured. Missing: ${config.missing.map((item) => `\`${item}\``).join(", ")}.`;
    updateHealth({ ok: false, userMessage });
    return {
      sent: false,
      code: "NOT_CONFIGURED",
      retryable: false,
      error: userMessage,
      userMessage,
    };
  }
  const result = await sendWithRetry(() =>
    Promise.race([
      transport.sendMail({
        from: config.from,
        to,
        subject,
        text,
        html,
        attachments,
        headers,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              Object.assign(new Error("Email provider timed out."), {
                code: "ETIMEDOUT",
              }),
            ),
          MAIL_TIMEOUT_MS,
        ),
      ),
    ]),
  );
  if (result.sent) return result;
  updateHealth({ ok: false, userMessage: result.userMessage });
  console.error(
    `Email delivery failed [${result.code}]: ${result.userMessage}`,
  );
  return result;
}

export async function sendWithRetry(operation, { maxAttempts = 3 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await operation();
      return { sent: true };
    } catch (error) {
      const classified = classifyMailError(error);
      if (!classified.retryable || attempt === maxAttempts)
        return { sent: false, ...classified, error: classified.userMessage };
      const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS.at(-1);
      await new Promise((resolve) =>
        setTimeout(resolve, delay + Math.floor(Math.random() * 100)),
      );
    }
  }
  return {
    sent: false,
    code: "MAIL_ERROR",
    retryable: false,
    userMessage: "The email provider could not send this message.",
  };
}

export async function verifyMailer() {
  if (!transport) {
    updateHealth({ ok: false });
    console.error(`Mailer status: not configured (${health.userMessage})`);
    return false;
  }
  try {
    await transport.verify();
    updateHealth({ ok: true, userMessage: "Email provider is working." });
    console.log("Mailer status: ok");
    return true;
  } catch (error) {
    const result = classifyMailError(error);
    updateHealth({ ok: false, ...result, userMessage: result.userMessage });
    console.error(`Mailer status: ${result.code} (${result.userMessage})`);
    return false;
  }
}

export async function verifyTransport() {
  await verifyMailer();
  return { ok: health.ok === true, message: health.userMessage };
}

export async function passwordResetEmail({ email, token, staff = false }) {
  return renderResetPassword({ email, token, staff });
}
