import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
import { useAuth } from '@/features/auth/session'
import { useSettings } from '@/features/settings/provider'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { authenticate, getApiErrorDetails } from '@/lib/api/auth'
import { getDashboardPath } from '@/lib/dashboard-path'
import { AuthAlert, AuthHeading, NetworkAlert } from './AuthShell'
import { GoogleButton } from './GoogleButton'
import { PasswordField } from './PasswordField'
import { loginSchema, type LoginValues } from './schemas'

type LoginFormProps = {
  isStaffAlias: boolean
  oauthError: string
}

export function LoginForm({ isStaffAlias, oauthError }: LoginFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const { settings, loading: settingsLoading, refreshSettings } = useSettings()
  const recaptchaRef = useRef(null)
  const recaptcha = useRecaptcha({
    enabled: settings.recaptchaEnabled,
    siteKey: settings.recaptchaSiteKey,
    recaptchaRef,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(oauthError)
  const [networkError, setNetworkError] = useState('')
  const from = (location.state as { from?: unknown } | null)?.from

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
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
      const response = await authenticate('login', {
        email: values.email,
        password: values.password,
        ...(recaptcha.enabled && recaptcha.token ? { recaptchaToken: recaptcha.token } : {}),
      })
      const nextUser = response.data?.user || null
      setUser(nextUser)
      navigate(
        typeof from === 'string' && from.startsWith('/') ? from : getDashboardPath(nextUser),
        { replace: true },
      )
    } catch (requestError) {
      const details = getApiErrorDetails(requestError)
      if (details.isNetwork) {
        setNetworkError(details.message)
      } else {
        setError(details.message)
        for (const [field, message] of Object.entries(details.fieldErrors)) {
          if (field === 'email' || field === 'password') {
            form.setError(field, { message })
          }
        }
      }
      form.setValue('password', '')
      recaptcha.reset()
      if (details.code === 'RECAPTCHA_FAILED' || details.code === 'RECAPTCHA_UNAVAILABLE') {
        void refreshSettings()
      }
    } finally {
      setLoading(false)
    }
  })

  return (
    <>
      <AuthHeading
        eyebrow="AbsoluteCare sign-in"
        title="Welcome back"
        description="Log in to manage your appointments and keep care moving."
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
          <PasswordField
            control={form.control}
            name="password"
            label="Password"
            autoComplete="current-password"
            footer={
              <Link
                className="mt-1 inline-block text-[11.5px] font-semibold text-eyebrow underline-offset-4 hover:underline"
                to="/forgot-password"
              >
                Forgot password?
              </Link>
            }
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
              'Log in'
            )}
          </Button>
        </form>
      </Form>
      {settings.googleAuthEnabled ? (
        <>
          <div className="my-5 flex items-center gap-3 text-[11px] text-ink-faint">
            <span className="h-px flex-1 bg-hairline" />
            or
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <GoogleButton from={from} />
        </>
      ) : null}
      <p className="mt-6 text-center text-[12px] text-ink-soft">
        Don’t have an account?{' '}
        <button
          type="button"
          className="font-semibold text-eyebrow underline-offset-4 hover:underline"
          onClick={() => navigate('/auth?mode=signup')}
        >
          Sign up
        </button>
      </p>
    </>
  )
}
