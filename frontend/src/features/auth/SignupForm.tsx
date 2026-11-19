import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LegalContent } from '@/features/legal/LegalContent'
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
import { authenticate, getApiErrorDetails, type AuthPayload } from '@/lib/api/auth'
import { consumePostAuthRedirect } from '@/lib/dashboard-path'
import { cn } from '@/lib/utils'
import { AuthAlert, AuthHeading, NetworkAlert } from './AuthShell'
import { GoogleButton } from './GoogleButton'
import { PasswordField } from './PasswordField'
import { signupSchema, type SignupValues } from './schemas'

// Same field treatment as the login card.
const inputClass = 'h-10 border-hairline bg-transparent'
const hintClass = 'text-[11.5px] leading-relaxed'
const legalLinkClass =
  'rounded-sm font-semibold text-eyebrow underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none'

// The input shows the local part only; the form value carries the +63 prefix.
function toPhoneValue(input: string) {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('63') && digits.length > 10) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  return digits ? `+63${digits}` : ''
}

type SignupFormProps = {
  isStaffAlias: boolean
}

export function SignupForm({ isStaffAlias }: SignupFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const { settings, loading: settingsLoading, refreshSettings } = useSettings()
  const minLength = settings.passwordMinLength || 8
  const [returnTo] = useState(() =>
    consumePostAuthRedirect((location.state as { from?: unknown } | null)?.from),
  )
  const recaptchaRef = useRef(null)
  const recaptcha = useRecaptcha({
    enabled: settings.recaptchaEnabled,
    siteKey: settings.recaptchaSiteKey,
    recaptchaRef,
  })
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [networkError, setNetworkError] = useState('')

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema(minLength)),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  })

  const password = useWatch({ control: form.control, name: 'password' })
  const confirmPassword = useWatch({ control: form.control, name: 'confirmPassword' })
  const terms = useWatch({ control: form.control, name: 'terms' })
  const checks = [
    { met: password.length >= minLength, label: `${minLength}+ characters` },
    { met: /[A-Z]/.test(password), label: 'a capital letter' },
    { met: /\d/.test(password), label: 'a number' },
  ]
  const strength = checks.filter((check) => check.met).length
  const missing = checks.filter((check) => !check.met).map((check) => check.label)
  const passwordMatch = confirmPassword.length > 0 && password === confirmPassword

  const onSubmit = form.handleSubmit(async (values) => {
    setError('')
    setNetworkError('')
    if (recaptcha.enabled && !recaptcha.token) {
      recaptcha.reset('Verify reCAPTCHA before continuing.')
      return
    }
    setLoading(true)
    try {
      const payload: AuthPayload = {
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        confirmPassword: values.confirmPassword,
        phone: values.phone,
        acceptedTerms: values.terms,
      }
      if (recaptcha.enabled && recaptcha.token) payload.recaptchaToken = recaptcha.token
      const response = await authenticate('signup', payload)
      if (response.data.pending) {
        setError(response.data.message || 'Your account requires approval before you can sign in.')
        return
      }
      const nextUser = response.data.user
      if (!nextUser) {
        setError('Your account was created, but sign-in could not be completed. Please log in.')
        return
      }
      setUser(nextUser)
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      const details = getApiErrorDetails(requestError)
      const captchaError = recaptcha.handleError(details.code)
      if (captchaError) {
        void refreshSettings()
      } else if (details.isNetwork) {
        setNetworkError(details.message)
      } else {
        setError(details.message)
        const knownFields = [
          'firstName',
          'lastName',
          'phone',
          'email',
          'password',
          'confirmPassword',
          'terms',
        ] as const
        for (const [field, message] of Object.entries(details.fieldErrors)) {
          const match = knownFields.find((name) => name === field)
          if (match) form.setError(match, { message })
        }
      }
      if (!captchaError) {
        form.setValue('password', '')
        form.setValue('confirmPassword', '')
        recaptcha.reset()
      }
    } finally {
      setLoading(false)
    }
  })

  return (
    <>
      <AuthHeading
        eyebrow="AbsoluteCare sign-up"
        title="Create your account"
        description="It takes a minute, then you can request your first session."
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

      <Dialog
        open={legal !== null}
        onOpenChange={(open) => {
          if (!open) setLegal(null)
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {legal === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'}
            </DialogTitle>
            <DialogDescription>Review without leaving your signup form.</DialogDescription>
          </DialogHeader>
          <LegalContent />
        </DialogContent>
      </Dialog>

      <Form {...form}>
        <form
          className="grid gap-4 sm:grid-cols-2 sm:gap-x-4 [@media(max-height:780px)]:gap-3"
          onSubmit={onSubmit}
          noValidate
        >
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input autoComplete="given-name" className={inputClass} {...field} />
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
                  <Input autoComplete="family-name" className={inputClass} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile number</FormLabel>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-hairline pr-2 pl-2.5 text-[13px] text-ink-soft"
                  >
                    +63
                  </span>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="917 123 4567"
                      aria-label="Mobile number, after the +63 country code"
                      className={cn(inputClass, 'pl-[52px]')}
                      {...field}
                      value={(field.value ?? '').replace(/^\+63/, '')}
                      onChange={(event) => field.onChange(toPhoneValue(event.target.value))}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
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
                    placeholder="name@example.com"
                    className={inputClass}
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
            autoComplete="new-password"
            hint={
              password ? (
                <div className="flex items-center gap-2" data-strength={strength}>
                  <div className="flex shrink-0 gap-1" aria-hidden="true">
                    {[1, 2, 3].map((step) => (
                      <span
                        key={step}
                        className={cn(
                          'h-1 w-5 rounded-full transition-colors',
                          strength >= step
                            ? strength === 3
                              ? 'bg-status-completed'
                              : 'bg-signal'
                            : 'bg-hairline',
                        )}
                      />
                    ))}
                  </div>
                  <span className={cn(hintClass, 'text-ink-soft')}>
                    {missing.length ? `Use ${missing.join(', ')}` : 'Strong password'}
                  </span>
                </div>
              ) : null
            }
          />
          <PasswordField
            control={form.control}
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            hint={
              confirmPassword ? (
                <p
                  className={cn(
                    hintClass,
                    passwordMatch ? 'text-status-completed' : 'text-destructive',
                  )}
                >
                  {passwordMatch ? 'Passwords match' : 'Passwords do not match'}
                </p>
              ) : null
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:col-span-2">
            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem className="min-w-0 flex-1 basis-60">
                  <div className="flex items-start gap-2.5">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked === true)
                          if (checked === true) setError('')
                        }}
                        className="mt-px"
                      />
                    </FormControl>
                    <FormLabel className="block text-[12px] leading-snug font-normal text-pretty text-ink-soft">
                      I agree to the{' '}
                      <button
                        type="button"
                        className={legalLinkClass}
                        onClick={(event) => {
                          event.preventDefault()
                          setLegal('terms')
                        }}
                      >
                        Terms and Conditions
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        className={legalLinkClass}
                        onClick={(event) => {
                          event.preventDefault()
                          setLegal('privacy')
                        }}
                      >
                        Privacy Policy
                      </button>
                    </FormLabel>
                  </div>
                  <FormMessage className="pl-6.5" />
                </FormItem>
              )}
            />
            {recaptcha.enabled ? (
              <RecaptchaField
                enabled={recaptcha.enabled}
                error={recaptcha.error}
                siteKey={settings.recaptchaSiteKey}
                onChange={(token: string | null) => {
                  recaptcha.setToken(token)
                }}
                onExpired={() => {
                  recaptcha.reset('Your verification expired. Please try again.')
                }}
                onErrored={() => {
                  recaptcha.reset('Invalid CAPTCHA')
                }}
                recaptchaRef={recaptchaRef}
                {...recaptcha.containerProps}
              />
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-1 h-10 w-full sm:col-span-2"
            disabled={settingsLoading || loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      </Form>

      {settings.googleAuthEnabled ? (
        <>
          <div className="my-5 flex items-center [@media(max-height:780px)]:my-3 gap-3 text-[11px] text-ink-faint">
            <span className="h-px flex-1 bg-hairline" />
            or
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <GoogleButton
            from={returnTo}
            blocked={!terms}
            onBlocked={() =>
              setError('Agree to the Terms and Privacy Policy above before continuing with Google.')
            }
          />
        </>
      ) : null}
      <p className="mt-6 text-center text-[12px] text-ink-soft [@media(max-height:780px)]:mt-4">
        Already have an account?{' '}
        <button
          type="button"
          className="font-semibold text-eyebrow underline-offset-4 hover:underline"
          onClick={() => navigate('/auth?mode=login')}
        >
          Log in
        </button>
      </p>
    </>
  )
}
