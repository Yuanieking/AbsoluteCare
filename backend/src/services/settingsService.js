import AppSetting from "../models/appSettingModel.js";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_SECRET_KEY,
  RECAPTCHA_SECRET_KEY,
  SMTP_PASSWORD,
  SMTP_USER,
  GMAIL_APP_PASSWORD,
  GMAIL_USER,
  RECAPTCHA_SITE_KEY,
} from "../config/env.js";
import {
  getIntegrationDetails,
  getIntegrationStatus,
} from "../config/integrations.js";

const integrationDefaults = {
  googleAuthEnabled: true,
  recaptchaEnabled: true,
  googleCalendarEnabled: true,
};

const configured = (value) =>
  typeof value === "string" && value.trim().length > 0;

let cache = null;
let cacheExpires = 0;
export const invalidateSettingsCache = () => {
  cache = null;
  cacheExpires = 0;
};

export async function getSettings() {
  if (cache && cacheExpires > Date.now()) return cache;
  let settings = await AppSetting.findOne({ key: "singleton" });
  if (!settings) {
    settings = await AppSetting.create({
      key: "singleton",
      integrations: integrationDefaults,
    });
  } else {
    const missing = Object.fromEntries(
      Object.entries(integrationDefaults)
        .filter(
          ([field]) => typeof settings.integrations?.[field] !== "boolean",
        )
        .map(([field, value]) => [`integrations.${field}`, value]),
    );
    if (Object.keys(missing).length) {
      settings = await AppSetting.findOneAndUpdate(
        { _id: settings._id },
        { $set: missing },
        { new: true },
      );
    }
  }
  settings = settings.toObject ? settings.toObject() : settings;
  cache = settings;
  cacheExpires = Date.now() + 60_000;
  return settings;
}

export function integrationStatus() {
  return getIntegrationStatus();
}

export function effectiveIntegrationEnabled(settings, key) {
  const field = `${key}Enabled`;
  return Boolean(
    settings?.integrations?.[field] && getIntegrationStatus()[key]?.configured,
  );
}

export function isRecaptchaRequired(settings) {
  return Boolean(
    settings?.integrations?.recaptchaEnabled &&
    getIntegrationStatus().recaptcha.configured,
  );
}

export function publicSettings(settings) {
  const status = getIntegrationStatus();
  const recaptchaEnabled = isRecaptchaRequired(settings);
  return {
    googleAuthEnabled: Boolean(
      settings.integrations.googleAuthEnabled && status.googleAuth.configured,
    ),
    patientRegistrationEnabled: settings.auth.patientRegistrationEnabled,
    recaptchaEnabled,
    ...(recaptchaEnabled
      ? { recaptchaSiteKey: RECAPTCHA_SITE_KEY.trim() }
      : {}),
    onlineBookingEnabled: settings.booking.onlineBookingEnabled,
    maintenanceMode: settings.system.maintenanceMode,
    maintenanceMessage: settings.system.maintenanceMessage,
    announcement: settings.system.announcement,
    clinicName: settings.general.clinicName,
    phone: settings.general.phone,
    email: settings.general.email,
    termsVersion: settings.auth.termsVersion,
    passwordMinLength: settings.auth.passwordMinLength,
    currency: settings.general.currency,
    timezone: settings.general.timezone,
  };
}

export { getIntegrationDetails };
