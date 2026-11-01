import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useSettings } from '@/features/settings/provider'
import { AuthShell } from './AuthShell'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'

type AuthMode = 'login' | 'signup' | 'forgot'

const modeByPath: Record<string, AuthMode> = {
  '/signup': 'signup',
  '/forgot-password': 'forgot',
  '/staff/forgot-password': 'forgot',
  '/staff/login': 'login',
  '/login': 'login',
  '/auth': 'login',
}

const oauthMessages: Record<string, string> = {
  'Google did not return a valid session.': 'Google sign-in did not return a valid session.',
}

function friendlyOAuthError(raw: string) {
  if (!raw) return ''
  return oauthMessages[raw] || raw
}

export default function AuthPage() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const requested = searchParams.get('mode') ?? modeByPath[pathname] ?? 'login'
  const mode: AuthMode = requested === 'signup' || requested === 'forgot' ? requested : 'login'
  const isStaffAlias = pathname.startsWith('/staff')
  const oauthError = friendlyOAuthError(searchParams.get('oauthError') ?? '')
  const { refreshSettings } = useSettings()

  useEffect(() => {
    void refreshSettings()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshSettings()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [refreshSettings, mode])

  return (
    <AuthShell isStaffAlias={isStaffAlias} wide={mode === 'signup'}>
      {mode === 'signup' ? <SignupForm isStaffAlias={isStaffAlias} /> : null}
      {mode === 'forgot' ? <ForgotPasswordForm isStaffAlias={isStaffAlias} /> : null}
      {mode === 'login' ? <LoginForm isStaffAlias={isStaffAlias} oauthError={oauthError} /> : null}
    </AuthShell>
  )
}
