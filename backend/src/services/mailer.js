import crypto from "node:crypto";
import { getIntegrationConfig } from "../config/runtimeConfig.js";
import { resetPassword as renderResetPassword } from "../emails/templates/index.js";
import { getSettings, isEmailSendingEnabled } from "./settingsService.js";

const BREVO_BASE_URL = "https://api.brevo.com/v3";
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
  const apiKey = clean(getIntegrationConfig("BREVO_API_KEY"));
  const from = clean(getIntegrationConfig("MAIL_FROM"));
  const missing = [];
  if (!usable(apiKey)) missing.push("BREVO_API_KEY");
  if (!usable(from)) missing.push("MAIL_FROM");
  return { apiKey, from, missing };
}

function parseSender(from) {
  const trimmed = from.trim();
  const match = /^(.*?)<([^<>]+)>\s*$/.exec(trimmed);
  const email = match ? (match[2] ?? "").trim() : "";
  if (!match || !email) return { email: trimmed };
  const name = (match[1] ?? "")
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
  return name ? { name, email } : { email };
}

function recipients(to) {
  const raw = Array.isArray(to) ? to : String(to ?? "").split(",");
  return raw
    .map((value) => {
      const match = /<([^<>]+)>/.exec(value);
      return (match?.[1] ?? value).trim();
    })
    .filter(Boolean)
    .map((email) => ({ email }));
}

function brevoPayload(config, message) {
  const payload = {
    sender: parseSender(config.from),
    to: recipients(message.to),
    subject: message.subject,
    htmlContent: message.html,
  };
  // An empty text part would suppress Brevo's own plain-text generation.
  if (typeof message.text === "string" && message.text.trim())
    payload.textContent = message.text;
  if (message.headers && Object.keys(message.headers).length)
    payload.headers = { ...message.headers };
  if (message.attachments?.length)
    payload.attachment = message.attachments.map((attachment) => ({
      name: attachment.filename,
      // Brevo takes base64 here; the .ics invite is the only attachment.
      content: Buffer.from(attachment.content, "utf8").toString("base64"),
    }));
  return payload;
}

async function brevoFetch(
  pathname,
  apiKey,
  { method = "GET", body, timeoutMs = MAIL_TIMEOUT_MS } = {},
) {
  let response;
  try {
    response = await fetch(`${BREVO_BASE_URL}${pathname}`, {
      method,
      headers: {
        "api-key": apiKey,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = String(error?.name || "");
    const code =
      name === "TimeoutError" || name === "AbortError"
        ? "ETIMEDOUT"
        : "ECONNECTION";
    throw Object.assign(
      new Error(
        code === "ETIMEDOUT"
          ? "Brevo took too long to respond."
          : "Couldn't reach Brevo.",
      ),
      { code },
    );
  }
  const parsed = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body: parsed };
}

function brevoFailure(status, body) {
  const payload = body ?? {};
  const message = String(
    payload.message || `Brevo responded with HTTP ${status}.`,
  );
  return Object.assign(new Error(message), { status });
}

export function classifyMailError(error) {
  const source = error ?? {};

  const code = String(source.code || "").toUpperCase();
  const name = String(source.name || "");
  const message = String(source.message || "");
  const status = Number(
    source.status || source.statusCode || source.responseCode || 0,
  );
  const unavailable =
    "The email provider is temporarily unavailable. Please try again.";

  if (code === "NOT_CONFIGURED") {
    const missing = Array.isArray(source.missing)
      ? source.missing
      : ["BREVO_API_KEY"];
    return {
      code,
      retryable: false,
      userMessage: `Email isn't configured. Missing: ${missing
        .map((item) => `\`${item}\``)
        .join(", ")}.`,
    };
  }
  if (code === "EMAIL_DISABLED") {
    return {
      code,
      retryable: false,
      userMessage:
        "Email sending is turned off in Settings, so nothing was sent.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      code: "BREVO_UNAUTHORIZED",
      retryable: false,
      userMessage:
        "Brevo rejected the API key. Copy a v3 key again from Brevo → SMTP & API → API keys.",
    };
  }
  if (status === 400) {
    // Brevo exposes no stable machine code for sender verification.
    if (/sender|verified|from/i.test(message)) {
      return {
        code: "SENDER_NOT_VERIFIED",
        retryable: false,
        userMessage:
          "Brevo won't send from this sender address yet. Verify it in Brevo → Senders, then try again.",
      };
    }
    return {
      code: "BREVO_BAD_REQUEST",
      retryable: false,
      userMessage:
        "Brevo rejected this message. Check the sender address and recipient.",
    };
  }
  if (status === 429) {
    return {
      code: "BREVO_RATE_LIMIT",
      retryable: true,
      userMessage:
        "Brevo is limiting how much mail this account can send right now. Try again shortly — the free plan allows 300 emails a day.",
    };
  }
  if (status >= 500) {
    return {
      code: "BREVO_SERVER_ERROR",
      retryable: true,
      userMessage: "Brevo is temporarily unavailable. Please try again.",
    };
  }
  if (
    code === "ETIMEDOUT" ||
    name === "TimeoutError" ||
    name === "AbortError"
  ) {
    return { code: "ETIMEDOUT", retryable: true, userMessage: unavailable };
  }
  if (code === "ECONNECTION" || name === "TypeError") {
    return { code: "ECONNECTION", retryable: true, userMessage: unavailable };
  }
  return {
    code: code || "MAIL_ERROR",
    retryable: false,
    userMessage: "The email provider could not send this message.",
  };
}

export function createMailTransport(
  config = mailConfig(),
  timeoutMs = MAIL_TIMEOUT_MS,
) {
  if (config.missing.length) return null;
  return {
    async send(message) {
      const response = await brevoFetch("/smtp/email", config.apiKey, {
        method: "POST",
        body: brevoPayload(config, message),
        timeoutMs,
      });
      if (!response.ok) throw brevoFailure(response.status, response.body);
    },
    async verify() {
      const response = await brevoFetch("/account", config.apiKey, {
        timeoutMs,
      });
      if (!response.ok) throw brevoFailure(response.status, response.body);
    },
  };
}

let health = {
  configured: false,
  missing: [],
  lastCheck: null,
  ok: null,
  userMessage: "Email provider has not been checked yet.",
};

let cached = { hash: "", config: null, transport: null };

export function getMailTransport(config = mailConfig()) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex");
  if (cached.hash !== hash) {
    cached = { hash, config, transport: createMailTransport(config) };
    health = {
      ...health,
      configured: config.missing.length === 0,
      missing: config.missing,
      ok: null,
      userMessage: config.missing.length
        ? `Email isn't configured. Missing: ${config.missing.map((item) => `\`${item}\``).join(", ")}.`
        : "Email provider has not been checked yet.",
    };
  }
  return cached;
}

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
  // The admin switch is a master valve: when it is off nothing leaves the
  // server, including password resets and invitations that bypass
  // notification preferences.
  if (!isEmailSendingEnabled(await getSettings())) {
    const userMessage =
      "Email sending is turned off in Settings, so nothing was sent.";
    return {
      sent: false,
      code: "EMAIL_DISABLED",
      retryable: false,
      error: userMessage,
      userMessage,
    };
  }
  const { config, transport } = getMailTransport();
  if (!transport || !config) {
    const userMessage = `Email isn't configured. Missing: ${(config?.missing ?? ["BREVO_API_KEY"]).map((item) => `\`${item}\``).join(", ")}.`;
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
    transport.send({
      to,
      subject,
      ...(text === undefined ? {} : { text }),
      html,
      attachments,
      headers,
    }),
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
      const delay = RETRY_DELAYS[attempt - 1] ?? 750;
      await new Promise((resolve) =>
        setTimeout(resolve, delay + Math.floor(Math.random() * 100)),
      );
    }
  }
  return {
    sent: false,
    code: "MAIL_ERROR",
    retryable: false,
    error: "The email provider could not send this message.",
    userMessage: "The email provider could not send this message.",
  };
}

export async function verifyMailer() {
  const { transport } = getMailTransport();
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
    // A 403 from /v3/account can be a plan restriction rather than a bad key,
    // so it must never block a key that can still send.
    if (Number(error.status || 0) === 403) {
      updateHealth({ ok: true, userMessage: "Email provider is working." });
      console.warn(
        "Mailer status: Brevo blocked the account check (403); assuming the key is valid.",
      );
      return true;
    }
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
