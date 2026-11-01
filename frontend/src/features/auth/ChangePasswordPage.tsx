import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/session'
import { useSettings } from '@/features/settings/provider'
import { changePassword } from '@/lib/api/auth'
import { getToastError, showError, showSuccess } from '@/lib/toast'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const { settings } = useSettings()
  const minLength = settings.passwordMinLength || 8
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const needsTerms = !user?.acceptedTerms
  const [terms, setTerms] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < minLength) {
      setError(`Password must be at least ${minLength} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (needsTerms && !terms) {
      setError('You must agree to continue.')
      return
    }
    setSaving(true)
    try {
      const response = await changePassword({ password, confirmPassword })
      setUser(response.data.user ?? null)
      showSuccess('Password changed successfully.')
      navigate(user?.role === 'admin' ? '/staff/admin' : `/staff/${user?.role || 'therapist'}`, {
        replace: true,
      })
    } catch (requestError) {
      const message = getToastError(requestError, 'Unable to change password.')
      setError(message)
      showError(message)
    } finally {
      setSaving(false)
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-ink">
      <section className="w-full max-w-sm rounded-lg border border-hairline bg-panel p-7">
        <p className="text-[11.5px] font-medium text-ink-faint">First login</p>
        <h1 className="mt-1 font-display text-[22px] leading-[1.25] font-semibold tracking-[-0.015em] text-ink">
          Change your password
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Choose a private password before entering the staff portal.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-[12.5px] text-destructive"
          >
            {error}
          </p>
        )}

        <form className="mt-4 grid gap-3" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="new-password" className="text-[12.5px] text-ink-soft">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-password" className="text-[12.5px] text-ink-soft">
              Confirm password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          {needsTerms && (
            <div className="flex items-start gap-2 text-[12.5px] text-ink-soft">
              <Checkbox
                id="terms"
                checked={terms}
                onCheckedChange={(checked) => setTerms(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="font-normal">
                I agree to the{' '}
                <Link to="/terms" className="underline">
                  Terms and Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </Label>
            </div>
          )}
          <Button
            type="submit"
            className="mt-1 h-10"
            disabled={saving || (needsTerms && !terms)}
            aria-busy={saving}
          >
            {saving ? 'Saving…' : 'Continue'}
          </Button>
        </form>
      </section>
    </main>
  )
}
