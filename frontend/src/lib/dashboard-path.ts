type UserLike = { role?: string | null } | null | undefined

export function getDashboardPath(user: UserLike): string {
  const role = user?.role === 'user' ? 'patient' : user?.role
  if (role === 'patient') return '/dashboard'
  if (role === 'admin') return '/staff/admin'
  if (role === 'therapist') return '/staff/therapist'
  if (role === 'secretary') return '/staff/secretary'
  return '/'
}

const authPaths = [
  '/login',
  '/signup',
  '/auth',
  '/forgot-password',
  '/staff/login',
  '/staff/forgot-password',
  '/auth/callback',
  '/google/setup',
  '/reset-password',
  '/staff/reset-password',
]

export function isAuthPath(path: unknown): boolean {
  if (typeof path !== 'string' || !path.startsWith('/')) return true
  const pathname = path.split('?')[0]?.split('#')[0] ?? path
  return authPaths.some((authPath) => pathname === authPath || pathname.startsWith(`${authPath}/`))
}

export function isReturnablePath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !isAuthPath(path)
}

export function stashPostAuthRedirect(from: unknown) {
  try {
    if (isReturnablePath(from)) sessionStorage.setItem('postAuthRedirect', from)
  } catch {}
}

export function consumePostAuthRedirect(stateFrom?: unknown): string {
  try {
    const stored = sessionStorage.getItem('postAuthRedirect')
    sessionStorage.removeItem('postAuthRedirect')
    if (isReturnablePath(stateFrom)) return stateFrom
    if (isReturnablePath(stored)) return stored
  } catch {
    if (isReturnablePath(stateFrom)) return stateFrom
  }
  return ''
}
