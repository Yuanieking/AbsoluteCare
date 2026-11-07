import { useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import RecaptchaField from '@/features/auth/RecaptchaField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { completeGoogleSignup, getApiErrorMessage } from '@/lib/api/auth'
import { consumePostAuthRedirect, getDashboardPath } from '@/lib/dashboard-path'
import { AuthAlert, AuthHeading, AuthShell } from './AuthShell'
import { googleSetupSchema, type GoogleSetupValues } from './schemas'

type GoogleProfile = {
  firstname?: string
  lastname?: string
  email?: string
  profilePicture?: string
}

function decodeToken(token: string): GoogleProfile | null {
  try {
    const encodedPayload = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (!encodedPayload) return null
    return JSON.parse(window.atob(encodedPayload)) as GoogleProfile
  } catch {
    return null
  }
}

export default function GoogleAccountSetupPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const { settings } = useSettings()
  const recaptchaRef = useRef(null)
  const recaptcha = useRecaptcha({
    enabled: settings.recaptchaEnabled,
    siteKey: settings.recaptchaSiteKey,
    recaptchaRef,
  })
  const token = searchParams.get('token') || ''
  const profile = useMemo(() => decodeToken(token), [token])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(profile ? '' : 'This Google setup link is invalid or expired.')

  const form = useForm<GoogleSetupValues>({
    resolver: zodResolver(googleSetupSchema),
    defaultValues: {
      firstName: profile?.firstname || '',
      lastName: profile?.lastname || '',
      terms: false,
    },
  })

  const terms = useWatch({ control: form.control, name: 'terms' })

  const onSubmit = form.handleSubmit(async (values) => {
    setError('')
    if (recaptcha.enabled && !recaptcha.token) {
      setError('Verify reCAPTCHA before continuing.')
      return
    }
    setLoading(true)
    try {
      const response = await completeGoogleSignup({
        token,
        firstName: values.firstName,
        lastName: values.lastName,
        terms: values.terms,
        ...(recaptcha.enabled && recaptcha.token ? { recaptchaToken: recaptcha.token } : {}),
      })
      const nextUser = response.data?.user || null
      setUser(nextUser)
      const from = consumePostAuthRedirect()
      navigate(from || getDashboardPath(nextUser), { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
      recaptcha.reset()
    } finally {
      setLoading(false)
    }
  })

  return (
    <AuthShell>
      <div className="mb-7 flex justify-center">
        {profile?.profilePicture ? (
          <img
            className="size-16 rounded-full object-cover"
            src={profile.profilePicture}
            alt="Google profile"
            width={64}
            height={64}
          />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-full bg-sunk font-display text-2xl font-semibold text-ink">
            {profile?.firstname?.[0] || 'A'}
          </span>
        )}
      </div>
      <AuthHeading
        eyebrow="Google account"
        title="Almost there!"
        description="Let’s finish setting up your account."
      />
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      <Form {...form}>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="given-name"
                      className="h-10 border-hairline bg-transparent"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="family-name"
                      className="h-10 border-hairline bg-transparent"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-[12px] font-medium" htmlFor="google-setup-email">
              Email
            </label>
            <Input
              id="google-setup-email"
              type="email"
              value={profile?.email || ''}
              readOnly
              aria-readonly="true"
              className="h-10 border-hairline bg-sunk/60"
            />
          </div>
          {recaptcha.enabled ? (
            <RecaptchaField
              enabled={recaptcha.enabled}
              error={error}
              siteKey={settings.recaptchaSiteKey}
              onChange={(nextToken: string | null) => {
                recaptcha.setToken(nextToken)
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
          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-2.5 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    className="mt-0.5"
                  />
                </FormControl>
                <div className="grid gap-1">
                  <FormLabel className="text-[12px] font-normal leading-relaxed">
                    I agree to the{' '}
                    <Link className="font-semibold underline" to="/terms">
                      Terms &amp; Conditions
                    </Link>{' '}
                    and{' '}
                    <Link className="font-semibold underline" to="/privacy">
                      Privacy Policy
                    </Link>
                    .
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          <Button
            type="submit"
            size="lg"
            className="mt-1 h-10 w-full"
            disabled={loading || !profile || !terms || (recaptcha.enabled && !recaptcha.token)}
          >
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              'Complete sign up'
            )}
          </Button>
        </form>
      </Form>
      <p className="mt-6 text-center text-[12px] text-ink-soft">
        <Link
          className="font-semibold text-eyebrow underline-offset-4 hover:underline"
          to="/auth?mode=login"
        >
          Use email login instead
        </Link>
      </p>
    </AuthShell>
  )
}
