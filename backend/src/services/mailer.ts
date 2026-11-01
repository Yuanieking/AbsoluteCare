import crypto from "node:crypto";
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { getIntegrationConfig } from "../config/runtimeConfig.js";
import { resetPassword as renderResetPassword } from "../emails/templates/index.js";
import { getSettings, isEmailSendingEnabled } from "./settingsService.js";

const MAIL_TIMEOUT_MS = 10_000;
const RETRY_DELAYS = [250, 750];
const PLACEHOLDERS = ["changeme", "xxx", "replace-with", "your-"];

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  missing: string[];
}

export interface MailHealth {
  configured: boolean;
  missing: string[];
  lastCheck: Date | null;
  ok: boolean | null;
  userMessage: string;
}

interface MailFailure {
  code: string;
  retryable: boolean;
  userMessage: string;
}

interface SendEmailOptions {
  to: SendMailOptions["to"];
  subject: SendMailOptions["subject"];
  text: SendMailOptions["text"];
  html: string;
  attachments?: SendMailOptions["attachments"];
  headers?: SendMailOptions["headers"];
}

export type SendEmailResult =
  | { sent: true }
  | ({ sent: false; error: string } & MailFailure);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function usable(value: unknown): boolean {
  const normalized = clean(value).toLowerCase();
  return (
    Boolean(normalized) &&
    !PLACEHOLDERS.some((item) => normalized.includes(item))
  );
}

function mailConfig(): MailConfig {
  const host = clean(getIntegrationConfig("SMTP_HOST"));
  const smtpUser = clean(getIntegrationConfig("SMTP_USER"));
  const smtpPass = clean(getIntegrationConfig("SMTP_PASS"));
  const gmailUser = clean(getIntegrationConfig("GMAIL_USER"));
  const gmailPass = clean(getIntegrationConfig("GMAIL_APP_PASSWORD"));
  const gmailCredentials = usable(gmailUser) && usable(gmailPass);
  const useGmailCredentials =
    /(^|\.)gmail\.com$/i.test(host) && gmailCredentials;
  const user = useGmailCredentials ? gmailUser : smtpUser || gmailUser;
  const pass = useGmailCredentials ? gmailPass : smtpPass || gmailPass;
  const port = Number(clean(getIntegrationConfig("SMTP_PORT")) || 465);
  const secureValue = clean(getIntegrationConfig("SMTP_SECURE"));
  const secure = secureValue
    ? secureValue.toLowerCase() === "true"
    : port === 465;
  const from = clean(getIntegrationConfig("MAIL_FROM"));
  const missing: string[] = [];
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

export function classifyMailError(error: unknown): MailFailure {
  const source = (error ?? {}) as {
    code?: string;
    responseCode?: number;
    statusCode?: number;
    missing?: string[];
  };
  const code = String(
    source.code || source.responseCode || "MAIL_ERROR",
  ).toUpperCase();
  const responseCode = Number(source.responseCode || source.statusCode || 0);
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
    code === "EDNS" ||
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
    const missing = Array.isArray(source.missing)
      ? source.missing
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

export function createMailTransport(
  config: MailConfig = mailConfig(),
): Transporter | null {
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

let health: MailHealth = {
  configured: false,
  missing: [],
  lastCheck: null,
  ok: null,
  userMessage: "Email provider has not been checked yet.",
};
let cached: {
  hash: string;
  config: MailConfig | null;
  transport: Transporter | null;
} = { hash: "", config: null, transport: null };

export function getMailTransport(
  config: MailConfig = mailConfig(),
): typeof cached {
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

export function getMailerHealth(): MailHealth {
  return { ...health };
}

function updateHealth(result: Partial<MailHealth>): void {
  health = { ...health, ...result, lastCheck: new Date() };
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments = [],
  headers = {},
}: SendEmailOptions): Promise<SendEmailResult> {
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
  if (!transport) {
    const userMessage = `Email isn't configured. Missing: ${(config as MailConfig).missing.map((item) => `\`${item}\``).join(", ")}.`;
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
        from: config?.from,
        to,
        subject,
        text,
        html,
        attachments,
        headers,
      }),
      new Promise<never>((_, reject) =>
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

export async function sendWithRetry(
  operation: () => Promise<unknown>,
  { maxAttempts = 3 }: { maxAttempts?: number } = {},
): Promise<SendEmailResult> {
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

export async function verifyMailer(): Promise<boolean> {
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
    const result = classifyMailError(error);
    updateHealth({ ok: false, ...result, userMessage: result.userMessage });
    console.error(`Mailer status: ${result.code} (${result.userMessage})`);
    return false;
  }
}

export async function verifyTransport(): Promise<{
  ok: boolean;
  message: string;
}> {
  await verifyMailer();
  return { ok: health.ok === true, message: health.userMessage };
}

export async function passwordResetEmail({
  email,
  token,
  staff = false,
}: {
  email: string;
  token: string;
  staff?: boolean;
}) {
  return renderResetPassword({ email, token, staff });
}
