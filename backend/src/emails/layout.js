import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AppSetting from "../models/appSettingModel.js";
import { FRONTEND_URL, MAIL_FROM } from "../config/env.js";
import { escapeHtml } from "./components.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devLogoPath = path.resolve(__dirname, "../../assets/email/logo.png");

let assetsWarningLogged = false;
let settingsWarningLogged = false;

function emailAddress(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match?.[1] || String(value || "")).trim();
}

export function validateEmailAssets() {
  const assetsBase = String(process.env.ASSETS_BASE_URL || "").trim();
  if (
    !assetsWarningLogged &&
    (!assetsBase ||
      !/^https:\/\/[^/]+/i.test(assetsBase) ||
      /localhost|127\.0\.0\.1/i.test(assetsBase))
  ) {
    console.warn(
      "Email assets: ASSETS_BASE_URL is missing or not a public HTTPS URL; using a CID logo attachment.",
    );
    assetsWarningLogged = true;
  }
}

export async function getEmailBranding() {
  let settings = null;
  try {
    if (AppSetting.db.readyState !== 1)
      throw new Error("database not connected");
    settings = await AppSetting.findOne({ key: "singleton" }).lean();
  } catch (error) {
    if (!settingsWarningLogged) {
      console.warn(
        `Email branding: clinic settings unavailable; using defaults (${error.name}).`,
      );
      settingsWarningLogged = true;
    }
  }
  const general = settings?.general || {};
  const assetsBase = String(process.env.ASSETS_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const hostedLogo =
    /^https:\/\/[^/]+/i.test(assetsBase) &&
    !/localhost|127\.0\.0\.1/i.test(assetsBase)
      ? `${assetsBase}/static/email/logo.png`
      : null;
  return {
    clinicName: general.clinicName || "AbsoluteCare Therapy Center",
    address: general.address || "Malaybalay City, Bukidnon",
    phone: general.phone || "",
    email: emailAddress(general.email || MAIL_FROM),
    logo: hostedLogo
      ? { src: hostedLogo, attachments: [] }
      : fs.existsSync(devLogoPath)
        ? {
            src: "cid:logo@absolutecare",
            attachments: [
              {
                filename: "logo.png",
                path: devLogoPath,
                cid: "logo@absolutecare",
              },
            ],
          }
        : { src: null, attachments: [] },
  };
}

function footer({ brand, recipientEmail, footerNote }) {
  const contact = [
    brand.address,
    brand.phone
      ? `<a href="tel:${escapeHtml(brand.phone)}" style="color:#536B64;">${escapeHtml(brand.phone)}</a>`
      : "",
    brand.email
      ? `<a href="mailto:${escapeHtml(brand.email)}" style="color:#536B64;">${escapeHtml(brand.email)}</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<tr><td style="padding:22px 24px 0;color:#536B64;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:center;">${escapeHtml(brand.clinicName)}<br />${contact}${recipientEmail ? `<br />Sent to ${escapeHtml(recipientEmail)}` : ""}<br />${escapeHtml(footerNote || "This is an automated message. Please don't reply.")}</td></tr>`;
}

export function emailLayout({
  preheader,
  title,
  intro,
  bodyHtml,
  primaryAction,
  secondaryHtml = "",
  footerNote = "",
  brand,
  recipientEmail,
}) {
  const logo = brand.logo.src
    ? `<img src="${escapeHtml(brand.logo.src)}" width="160" height="160" alt="${escapeHtml(brand.clinicName)}" style="display:block;border:0;width:160px;height:160px;object-fit:contain;margin:0 auto;" />`
    : `<span style="color:#0F3D3A;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;line-height:64px;">${escapeHtml(brand.clinicName)}</span>`;
  const actionHtml = primaryAction
    ? `<tr><td style="padding:8px 0 20px;">${primaryAction.html}<p style="margin:14px 0 0;color:#64748B;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;word-break:break-all;">Button not working? Copy and paste this link into your browser:<br /><a href="${escapeHtml(primaryAction.href, 4_000)}" style="color:#0F3D3A;">${escapeHtml(primaryAction.href, 4_000)}</a></p></td></tr>`
    : "";
  return `<!doctype html><html lang="en"><head><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escapeHtml(title)}</title><style>@media (max-width:480px){.email-shell{padding:12px!important}.email-card{width:100%!important}.email-content{padding:24px 18px!important}.email-button a{display:block!important;width:auto!important}.email-title{font-size:24px!important}}@media (prefers-color-scheme:dark){.email-card{background:#ffffff!important}.email-body,.email-footer{color:#D7E5DF!important}}</style></head><body style="margin:0;padding:0;background:#EEF3F1;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader, 140)}${"&nbsp; ".repeat(20)}</div><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#EEF3F1;"><tr><td class="email-shell" align="center" style="padding:24px;"><table class="email-card" role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #DCE8E2;border-radius:12px;overflow:hidden;"><tr><td style="padding:18px 24px;background:#ffffff;border-bottom:5px solid #D7E34A;text-align:center;">${logo}</td></tr><tr><td class="email-content email-body" style="padding:32px 40px;color:#334155;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;"><h1 class="email-title" style="margin:0 0 10px;color:#0F3D3A;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;">${escapeHtml(title)}</h1><p style="margin:0 0 24px;">${escapeHtml(intro)}</p>${bodyHtml}${actionHtml}${secondaryHtml}</td></tr></table><table class="email-footer" role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;">${footer({ brand, recipientEmail, footerNote })}</table></td></tr></table></body></html>`;
}

export function frontendUrl(pathname) {
  const base = FRONTEND_URL.replace(/\/$/, "");
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
