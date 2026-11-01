let authLoading = true
let wasAuthenticated = false
let sessionExpiryHandled = false

export function setAuthLoading(value: boolean) {
  authLoading = value
}

export function setAuthenticatedUser(user: unknown) {
  wasAuthenticated = Boolean(user)
  if (wasAuthenticated) sessionExpiryHandled = false
}

export function canHandleSessionExpiry(): boolean {
  if (authLoading || sessionExpiryHandled) return false

  const pathname = window.location.pathname
  const isProtectedRoute =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/profile' ||
    pathname === '/settings' ||
    pathname === '/staff' ||
    pathname.startsWith('/staff/')

  return wasAuthenticated || isProtectedRoute
}

export function markSessionExpiryHandled() {
  sessionExpiryHandled = true
  wasAuthenticated = false
}
