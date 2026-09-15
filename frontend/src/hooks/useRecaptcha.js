import { useCallback, useEffect, useState } from "react";

function removeRecaptchaArtifacts() {
  document
    .querySelectorAll('script[src*="google.com/recaptcha/api.js"]')
    .forEach((script) => script.remove());
  document
    .querySelectorAll(".grecaptcha-badge")
    .forEach((badge) => badge.remove());
}

export function useRecaptcha({ enabled, siteKey, recaptchaRef }) {
  const active = Boolean(enabled && siteKey);
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (!active) {
      setToken(null);
      removeRecaptchaArtifacts();
      return undefined;
    }
    return () => removeRecaptchaArtifacts();
  }, [active, siteKey]);

  const reset = useCallback(() => {
    setToken(null);
    recaptchaRef.current?.reset();
  }, [recaptchaRef]);

  return {
    enabled: active,
    token,
    setToken,
    reset,
    containerProps: { "data-recaptcha-enabled": active ? "true" : "false" },
  };
}
