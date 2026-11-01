import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { useSettings } from '@/features/settings/provider'
import { resetPassword } from '@/lib/api/auth'
import { getToastError, showError, showSuccess } from '@/lib/toast'
import { AuthAlert, AuthHeading, AuthShell, AuthSuccess } from './AuthShell'
import { PasswordField } from './PasswordField'
import { resetPasswordSchema, type ResetPasswordValues } from './schemas'

type ResetPasswordPageProps = {
  staff?: boolean
}

export default function ResetPasswordPage({ staff = false }: ResetPasswordPageProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const minLength = settings.passwordMinLength || 8
  const token = searchParams.get('token') || ''
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [complete, setComplete] = useState(false)

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema(minLength)),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError('')
    setSaving(true)
    try {
      await resetPassword({ token, password: values.password })
      setComplete(true)
      showSuccess('Password updated. You can now log in.')
      window.setTimeout(() => navigate(staff ? '/staff/login' : '/login'), 900)
    } catch (requestError) {
      const message = getToastError(requestError, 'This reset link is invalid or expired.')
      setError(message)
      showError(message)
    } finally {
      setSaving(false)
      form.reset()
    }
  })

  return (
    <AuthShell isStaffAlias={staff}>
      {complete ? (
        <AuthSuccess
          title="Password updated"
          description="Your password has been changed successfully."
        />
      ) : (
        <>
          <AuthHeading
            eyebrow="AbsoluteCare secure account access"
            title="Choose a new password"
            description={`Use at least ${minLength} characters, then confirm it below.`}
          />
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <Form {...form}>
            <form className="grid gap-4" onSubmit={onSubmit} noValidate>
              <PasswordField
                control={form.control}
                name="password"
                label="New password"
                autoComplete="new-password"
              />
              <PasswordField
                control={form.control}
                name="confirmPassword"
                label="Confirm password"
                autoComplete="new-password"
              />
              <Button
                type="submit"
                size="lg"
                className="mt-1 h-10 w-full"
                disabled={saving || !token}
              >
                {saving ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </Form>
          {!token ? (
            <p className="mt-4 bg-signal-soft px-3.5 py-3 text-[12.5px] text-signal">
              Request a new reset link to continue.
            </p>
          ) : null}
          <p className="mt-6 text-center text-[12px] text-ink-soft">
            <Link
              className="font-semibold text-eyebrow underline-offset-4 hover:underline"
              to={staff ? '/staff/login' : '/login'}
            >
              Back to log in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
