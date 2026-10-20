import { useCallback, useEffect, useState } from "react";
import { getPublicSettings } from "../services/api/settingsApi";
import SettingsContext from "./settingsContext";

const defaults = {
  googleAuthEnabled: false,
  patientRegistrationEnabled: true,
  recaptchaEnabled: false,
  recaptchaSiteKey: "",
  onlineBookingEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: "",
  announcement: { enabled: false, message: "", type: "info", expiresAt: null },
  clinicName: "AbsoluteCare Physical Therapy",
  phone: "",
  email: "",
  termsVersion: "1.0",
  passwordMinLength: 8,
  currency: "PHP",
  timezone: "Asia/Manila",
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const response = await getPublicSettings();
      setSettings((current) => ({
        ...current,
        ...response.data,
        recaptchaSiteKey: response.data.recaptchaEnabled
          ? response.data.recaptchaSiteKey || ""
          : "",
      }));
    } catch {
      setSettings(defaults);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(refreshSettings, 0);
    const interval = window.setInterval(refreshSettings, 180000);
    window.addEventListener("focus", refreshSettings);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(request);
      window.removeEventListener("focus", refreshSettings);
    };
  }, [refreshSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
