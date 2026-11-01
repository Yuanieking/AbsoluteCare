import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettings } from '@/features/settings/provider'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { authenticate, getApiErrorDetails, type AuthPayload } from '@/lib/api/auth'
import { consumePostAuthRedirect } from '@/lib/dashboard-path'
import { sanitizePhone } from '@/lib/validation'
import { AuthAlert, AuthHeading, AuthSuccess, NetworkAlert } from './AuthShell'
import { GoogleButton } from './GoogleButton'
import { PasswordField } from './PasswordField'
import { signupSchema, type SignupValues } from './schemas'

type SignupFormProps = {
  isStaffAlias: boolean
}

const roleOptions = [
  { value: 'patient', label: 'Patient' },
  { value: 'therapist', label: 'Therapist' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'admin', label: 'Admin' },
]

export function SignupForm({ isStaffAlias }: SignupFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [networkError, setNetworkError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pendingSignup, setPendingSignup] = useState(false)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema(minLength)),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      role: 'patient',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  })

  const password = useWatch({ control: form.control, name: 'password' })
  const confirmPassword = useWatch({ control: form.control, name: 'confirmPassword' })
  const terms = useWatch({ control: form.control, name: 'terms' })
  const role = useWatch({ control: form.control, name: 'role' })
  const strength = [
    password.length >= minLength,
    /[A-Z]/.test(password),
    /\d/.test(password),
  ].filter(Boolean).length
  const passwordMatch = confirmPassword.length > 0 && password === confirmPassword

  const onSubmit = form.handleSubmit(async (values) => {
    setError('')
    setNetworkError('')
    setPendingSignup(false)
    if (recaptcha.enabled && !recaptcha.token) {
      setError('Verify reCAPTCHA before continuing.')
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
        role: values.role,
        acceptedTerms: values.terms,
      }
      if (recaptcha.enabled && recaptcha.token) payload.recaptchaToken = recaptcha.token
      const response = await authenticate('signup', payload)
      if (response.data?.pending) {
        setPendingSignup(true)
      }
      setSubmitted(true)
    } catch (requestError) {
      const details = getApiErrorDetails(requestError)
      if (details.isNetwork) {
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
          'role',
          'terms',
        ] as const
        for (const [field, message] of Object.entries(details.fieldErrors)) {
          const match = knownFields.find((name) => name === field)
          if (match) form.setError(match, { message })
        }
      }
      form.setValue('password', '')
      form.setValue('confirmPassword', '')
      recaptcha.reset()
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
        title={pendingSignup ? 'Pending approval' : 'Account created'}
        description={
          pendingSignup
            ? 'Your staff account is pending admin approval. You will be able to sign in once an administrator activates it.'
            : 'Your AbsoluteCare account is ready. Log in to continue.'
        }
        action={
          <Button asChild size="lg" className="h-10">
            <Link to="/auth?mode=login" state={returnTo ? { from: returnTo } : undefined}>
              Log in
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <>
      <AuthHeading
        eyebrow="AbsoluteCare sign-in"
        title="Create your account"
        description="Set up your account to request appointments with ease."
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
        <form className="grid items-start gap-3.5 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
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
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile number</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="h-10 border-hairline bg-transparent"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(sanitizePhone(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-10 w-full border-hairline bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {role !== 'patient' ? (
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
                    Staff accounts require admin approval before you can sign in.
                  </p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
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
            autoComplete="new-password"
            footer={
              <div
                className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-none text-ink-faint"
                data-strength={strength}
              >
                <span className="mr-1 whitespace-nowrap">Password strength</span>
                {[1, 2, 3].map((step) => (
                  <i
                    key={step}
                    aria-hidden="true"
                    className={`h-1 w-5 shrink-0 ${
                      strength >= step
                        ? strength === 3
                          ? 'bg-status-completed'
                          : 'bg-signal'
                        : 'bg-hairline'
                    }`}
                  />
                ))}
                <b className="ml-1 font-medium whitespace-nowrap">
                  {strength === 3 ? 'Good' : strength === 2 ? 'Almost' : `Use ${minLength}+`}
                </b>
              </div>
            }
          />
          <PasswordField
            control={form.control}
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            footer={
              confirmPassword ? (
                <span
                  className={`mt-1 block text-[11px] ${
                    passwordMatch ? 'text-status-completed' : 'text-destructive'
                  }`}
                >
                  {passwordMatch ? 'Passwords match' : 'Passwords do not match'}
                </span>
              ) : null
            }
          />
          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-2.5 space-y-0 sm:col-span-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true)
                      if (checked === true) setError('')
                    }}
                    className="mt-0.5"
                  />
                </FormControl>
                <div className="grid gap-1">
                  <FormLabel className="text-[12px] font-normal leading-relaxed">
                    I agree to the{' '}
                    <Link className="font-semibold underline" to="/terms">
                      Terms and Conditions
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
          {recaptcha.enabled ? (
            <div className="sm:col-span-2">
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
            </div>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="mt-1 h-10 w-full sm:col-span-2"
            disabled={
              settingsLoading || loading || !terms || (recaptcha.enabled && !recaptcha.token)
            }
          >
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      </Form>
      {settings.googleAuthEnabled ? (
        <>
          <div className="my-4 flex items-center gap-3 text-[11px] text-ink-faint">
            <span className="h-px flex-1 bg-hairline" />
            or
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <GoogleButton
            from={returnTo}
            blocked={!terms}
            onBlocked={() => setError('You must agree to continue.')}
          />
        </>
      ) : null}
      <p className="mt-5 text-center text-[12px] text-ink-soft">
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
