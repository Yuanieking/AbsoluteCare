import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import RecaptchaField from '@/features/auth/RecaptchaField'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/features/settings/provider'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { getApiErrorDetails, requestPasswordReset } from '@/lib/api/auth'
import { AuthAlert, AuthHeading, AuthSuccess, NetworkAlert } from './AuthShell'
import { forgotPasswordSchema, type ForgotPasswordValues } from './schemas'

type ForgotPasswordFormProps = {
  isStaffAlias: boolean
}

export function ForgotPasswordForm({ isStaffAlias }: ForgotPasswordFormProps) {
  const navigate = useNavigate()
  const { settings, loading: settingsLoading, refreshSettings } = useSettings()
  const recaptchaRef = useRef(null)
  const recaptcha = useRecaptcha({
    enabled: settings.recaptchaEnabled,
    siteKey: settings.recaptchaSiteKey,
    recaptchaRef,
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [networkError, setNetworkError] = useState('')

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError('')
    setNetworkError('')
    if (recaptcha.enabled && !recaptcha.token) {
      setError('Verify reCAPTCHA before continuing.')
      return
    }
    setLoading(true)
    try {
      await requestPasswordReset(
        values.email,
        recaptcha.enabled ? (recaptcha.token ?? undefined) : undefined,
      )
      setSubmitted(true)
    } catch (requestError) {
      const details = getApiErrorDetails(requestError)
      if (details.isNetwork) {
        setNetworkError(details.message)
      } else {
        setError(details.message)
        if (details.fieldErrors.email) {
          form.setError('email', { message: details.fieldErrors.email })
        }
      }
      if (details.code === 'RECAPTCHA_FAILED' || details.code === 'RECAPTCHA_UNAVAILABLE') {
        void refreshSettings()
      }
    } finally {
      setLoading(false)
    }
  })

  if (submitted) {
    return (
      <AuthSuccess
        title="Check your inbox"
        description="If an account exists with this email, a reset link has been sent."
        action={
          <Button asChild size="lg" className="h-10">
            <Link to="/auth?mode=login">Back to log in</Link>
          </Button>
        }
      />
    )
  }

  return (
    <>
      <AuthHeading
        eyebrow="AbsoluteCare sign-in"
        title="Reset your password"
        description="Enter your email address and we'll send you a link to reset your password."
        hint={
          isStaffAlias
            ? 'Staff portal — same sign-in for everyone; you land on your workspace automatically.'
            : undefined
        }
      />
      {networkError ? (
        <NetworkAlert message={networkError} onDismiss={() => setNetworkError('')} />
      ) : null}
      {error && !networkError ? <AuthAlert>{error}</AuthAlert> : null}
      <Form {...form}>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    className="h-10 border-hairline bg-transparent"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {recaptcha.enabled ? (
            <RecaptchaField
              enabled={recaptcha.enabled}
              error={error}
              siteKey={settings.recaptchaSiteKey}
              onChange={(token: string | null) => {
                recaptcha.setToken(token)
                setError('')
              }}
              onExpired={() => {
                recaptcha.setToken(null)
                setError('Your verification expired. Please try again.')
              }}
              onErrored={() => {
                recaptcha.setToken(null)
                setError('Verify reCAPTCHA before continuing.')
              }}
              recaptchaRef={recaptchaRef}
              {...recaptcha.containerProps}
            />
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="mt-1 h-10 w-full"
            disabled={settingsLoading || loading || (recaptcha.enabled && !recaptcha.token)}
          >
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      </Form>
      <p className="mt-6 text-center text-[12px] text-ink-soft">
        Remembered your password?{' '}
        <button
          type="button"
          className="font-semibold text-eyebrow underline-offset-4 hover:underline"
          onClick={() => navigate('/auth?mode=login')}
        >
          Back to log in
        </button>
      </p>
    </>
  )
}
