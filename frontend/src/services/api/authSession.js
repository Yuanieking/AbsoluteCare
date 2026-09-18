let authLoading = true;
let wasAuthenticated = false;
let sessionExpiryHandled = false;

export function setAuthLoading(value) {
  authLoading = value;
}

export function setAuthenticatedUser(user) {
  wasAuthenticated = Boolean(user);
  if (wasAuthenticated) sessionExpiryHandled = false;
}

export function canHandleSessionExpiry() {
  if (authLoading || sessionExpiryHandled) return false;

  const pathname = window.location.pathname;
  const isProtectedRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/profile" ||
    pathname === "/settings" ||
    pathname === "/staff" ||
    pathname.startsWith("/staff/");

  return wasAuthenticated || isProtectedRoute;
}

export function markSessionExpiryHandled() {
  sessionExpiryHandled = true;
  wasAuthenticated = false;
}
