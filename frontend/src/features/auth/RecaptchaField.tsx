import ReCAPTCHA from 'react-google-recaptcha'

type RecaptchaFieldProps = {
  enabled: boolean
  error?: string
  siteKey: string
  onChange: (token: string | null) => void
  onExpired?: () => void
  onErrored?: () => void
  recaptchaRef: React.RefObject<ReCAPTCHA | null>
  containerProps?: Record<string, string>
}

export default function RecaptchaField({
  enabled,
  error,
  siteKey,
  onChange,
  onExpired,
  onErrored,
  recaptchaRef,
  containerProps = {},
}: RecaptchaFieldProps) {
  if (!enabled || !siteKey) return null
  return (
    <div className="grid gap-1" {...containerProps}>
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        onChange={onChange}
        onExpired={onExpired}
        onErrored={onErrored}
      />
      {error === 'recaptcha' && (
        <span className="text-[12px] text-destructive" role="alert">
          Verify reCAPTCHA before continuing.
        </span>
      )}
      {error === 'recaptcha-expired' && (
        <span className="text-[12px] text-destructive" role="alert">
          Your verification expired. Please try again.
        </span>
      )}
    </div>
  )
}
