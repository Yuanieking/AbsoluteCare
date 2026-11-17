import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import AppLoader from '@/components/feedback/AppLoader'
import { hasAreaAccess } from '@/app/nav-config'
import { useAuth } from '@/features/auth/session'
import { useSettings } from '@/features/settings/provider'
import { getDashboardPath, isReturnablePath } from '@/lib/dashboard-path'

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { settings } = useSettings()

  if (loading) {
    return (
      <AppLoader
        caption={location.pathname.startsWith('/staff') ? 'Loading staff portal...' : undefined}
      />
    )
  }

  if (!user) {
    return (
      <Navigate
        replace
        to="/login"
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    )
  }

  if (user.mustChangePassword && location.pathname !== '/staff/change-password') {
    return <Navigate replace to="/staff/change-password" />
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate replace to={getDashboardPath(user)} />
  }

  const area = areaForPath(location.pathname)
  if (area && !hasAreaAccess(user.role, area, settings.roleAccess)) {
    return <Navigate replace to={getDashboardPath(user)} />
  }

  return <Outlet />
}

type StaffArea =
  | 'appointments'
  | 'services'
  | 'sessions'
  | 'patients'
  | 'payments'
  | 'reports'
  | 'documents'
  | 'userManagement'
  | 'settings'
  | 'myActivity'

function areaForPath(pathname: string): StaffArea | undefined {
  if (pathname.endsWith('/my-activity') || pathname.includes('/my-activity/')) return 'myActivity'
  if (pathname.startsWith('/staff/documents')) return 'documents'
  if (pathname.includes('/appointments') || pathname.includes('/schedule')) return 'appointments'
  if (pathname.includes('/services')) return 'services'
  if (pathname.includes('/session')) return 'sessions'
  if (pathname.includes('/patients') || pathname.includes('/therapists')) return 'patients'
  if (pathname.includes('/payments')) return 'payments'
  if (pathname.includes('/reports')) return 'reports'
  if (pathname.includes('/users')) return 'userManagement'
  if (pathname.includes('/settings')) return 'settings'
  return undefined
}

/** Sends staff away from an area the admin has switched off for their role. */
export function AreaGuard({ area, children }: { area: 'documents'; children: ReactNode }) {
  const { user } = useAuth()
  const { settings } = useSettings()

  if (user && !hasAreaAccess(user.role, area, settings.roleAccess)) {
    return <Navigate replace to={getDashboardPath(user)} />
  }

  return children
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AppLoader />
  if (!user) return <Outlet />

  const requestedPath = (location.state as { from?: string } | null)?.from
  const destination =
    requestedPath && isReturnablePath(requestedPath) ? requestedPath : getDashboardPath(user)

  return <Navigate replace to={destination} />
}
