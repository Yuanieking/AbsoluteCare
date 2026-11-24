import { useCallback, useEffect, useState } from 'react'

function removeRecaptchaArtifacts() {
  document
    .querySelectorAll('script[src*="google.com/recaptcha/api.js"]')
    .forEach((script) => script.remove())
  document.querySelectorAll('.grecaptcha-badge').forEach((badge) => badge.remove())
}

/**
 * Inline messages for the server's CAPTCHA error codes. A failed or expired
 * challenge gets a plain retry message. Only key problems mention configuration:
 * RECAPTCHA_INVALID_KEY (Google answered invalid-input-secret) and
 * RECAPTCHA_MISCONFIGURED (no secret key is configured).
 */
const RECAPTCHA_ERROR_MESSAGES = {
  RECAPTCHA_FAILED:
    'Invalid Key. Google rejected this client ID and secret pair. Copy both again from the Google Cloud console.',
  RECAPTCHA_UNAVAILABLE: "We couldn't verify you right now. Please try again.",
  RECAPTCHA_INVALID_KEY:
    'Invalid Key. Google rejected this client ID and secret pair. Copy both again from the Google Cloud console.',
  RECAPTCHA_MISCONFIGURED:
    'CAPTCHA is not set up correctly (missing or invalid site key). Please contact the clinic.',
}

export function useRecaptcha({ enabled, siteKey, recaptchaRef }) {
  const active = Boolean(enabled && siteKey)
  const [state, setState] = useState({ siteKey, token: null, error: '' })
  const setToken = useCallback(
    (token) => {
      setState({ siteKey, token, error: '' })
    },
    [siteKey],
  )

  useEffect(() => {
    if (!active) {
      const request = window.setTimeout(() => setToken(null), 0)
      removeRecaptchaArtifacts()
      return () => window.clearTimeout(request)
    }
    return () => removeRecaptchaArtifacts()
  }, [active, siteKey, setToken])

  const reset = useCallback(
    (message = '') => {
      setState({ siteKey, token: null, error: message })
      const instance = recaptchaRef.current
      instance?.reset?.()
    },
    [recaptchaRef, siteKey],
  )

  const handleError = (code) => {
    const message = RECAPTCHA_ERROR_MESSAGES[code]
    if (!message) return false
    reset(message)
    return true
  }

  return {
    enabled: active,
    token: active && state.siteKey === siteKey ? state.token : null,
    error: active && state.siteKey === siteKey ? state.error : '',
    setToken,
    reset,
    handleError,
    containerProps: { 'data-recaptcha-enabled': active ? 'true' : 'false' },
  }
}
