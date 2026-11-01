import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/session'
import { getApiErrorMessage, getGoogleSession } from '@/lib/api/auth'
import { consumePostAuthRedirect, getDashboardPath } from '@/lib/dashboard-path'
import { AuthShell } from './AuthShell'

export default function GoogleAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const token = searchParams.get('token')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    getGoogleSession(token)
      .then((response) => {
        const nextUser = response.data?.user || null
        setUser(nextUser)
        const from = consumePostAuthRedirect((location.state as { from?: unknown } | null)?.from)
        navigate(from || getDashboardPath(nextUser), { replace: true })
      })
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
  }, [navigate, setUser, token, location.state])

  const displayError = error || (!token && 'Google sign-in did not return a valid session.')

  return (
    <AuthShell>
      <div className="text-center">
        {displayError ? (
          <>
            <CircleAlert className="mx-auto mb-6 size-11 text-destructive" aria-hidden="true" />
            <h1 className="font-display text-[30px] leading-none font-semibold tracking-[-0.03em]">
              Sign-in could not finish
            </h1>
            <p className="mx-auto mt-4 mb-7 max-w-[310px] text-[13px] leading-relaxed text-ink-soft">
              {displayError}
            </p>
            <Button asChild size="lg" className="h-10">
              <Link to="/auth?mode=login">Back to log in</Link>
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle
              className="mx-auto mb-6 size-10 animate-spin text-eyebrow"
              aria-hidden="true"
            />
            <h1 className="font-display text-[30px] leading-none font-semibold tracking-[-0.03em]">
              Signing you in
            </h1>
            <p className="mx-auto mt-4 max-w-[310px] text-[13px] leading-relaxed text-ink-soft">
              We’re securely finishing your Google sign-in.
            </p>
          </>
        )}
      </div>
    </AuthShell>
  )
}
