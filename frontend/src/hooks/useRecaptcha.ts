import { useCallback, useEffect, useState } from 'react'

function removeRecaptchaArtifacts() {
  document
    .querySelectorAll('script[src*="google.com/recaptcha/api.js"]')
    .forEach((script) => script.remove())
  document.querySelectorAll('.grecaptcha-badge').forEach((badge) => badge.remove())
}

export type RecaptchaOptions = {
  enabled: boolean
  siteKey: string
  recaptchaRef: { current: unknown }
}

export type RecaptchaState = {
  enabled: boolean
  token: string | null
  setToken: (token: string | null) => void
  reset: () => void
  containerProps: { 'data-recaptcha-enabled': string }
}

export function useRecaptcha({ enabled, siteKey, recaptchaRef }: RecaptchaOptions): RecaptchaState {
  const active = Boolean(enabled && siteKey)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!active) {
      const request = window.setTimeout(() => setToken(null), 0)
      removeRecaptchaArtifacts()
      return () => window.clearTimeout(request)
    }
    return () => removeRecaptchaArtifacts()
  }, [active, siteKey])

  const reset = useCallback(() => {
    setToken(null)
    const instance = recaptchaRef.current as { reset?: () => void } | null
    instance?.reset?.()
  }, [recaptchaRef])

  return {
    enabled: active,
    token,
    setToken,
    reset,
    containerProps: { 'data-recaptcha-enabled': active ? 'true' : 'false' },
  }
}
