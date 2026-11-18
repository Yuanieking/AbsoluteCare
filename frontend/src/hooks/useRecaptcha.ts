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
  error: string
  setToken: (token: string | null) => void
  reset: (error?: string) => void
  handleError: (code: string) => boolean
  containerProps: { 'data-recaptcha-enabled': string }
}

export function useRecaptcha({ enabled, siteKey, recaptchaRef }: RecaptchaOptions): RecaptchaState {
  const active = Boolean(enabled && siteKey)
  const [state, setState] = useState({ siteKey, token: null as string | null, error: '' })
  const setToken = useCallback(
    (token: string | null) => {
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
      const instance = recaptchaRef.current as { reset?: () => void } | null
      instance?.reset?.()
    },
    [recaptchaRef, siteKey],
  )

  const handleError = (code: string) => {
    if (code !== 'RECAPTCHA_FAILED' && code !== 'RECAPTCHA_UNAVAILABLE') return false
    reset(
      code === 'RECAPTCHA_FAILED'
        ? 'Invalid CAPTCHA'
        : "We couldn't verify you right now. Please try again.",
    )
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
