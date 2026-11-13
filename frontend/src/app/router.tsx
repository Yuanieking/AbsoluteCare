/* eslint-disable react-refresh/only-export-components -- the route table is a module, not a component file */
import { Suspense, lazy, type ReactElement } from 'react'
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom'
import AppLoader from '@/components/feedback/AppLoader'
import { PageSkeletonFallback, type SkeletonVariant } from '@/components/feedback/Skeletons'
import PatientLayout from '@/components/layout/PatientLayout'
import StaffLayout from '@/components/layout/StaffLayout'
import { AreaGuard, ProtectedRoute, PublicOnlyRoute } from '@/app/routes/ProtectedRoute'
import RouteErrorBoundary from '@/app/routes/RouteErrorBoundary'
import { useAuth } from '@/features/auth/session'

const Auth = lazy(() => import('@/features/auth/AuthPage'))
const GoogleAccountSetup = lazy(() => import('@/features/auth/GoogleAccountSetupPage'))
const GoogleAuthCallback = lazy(() => import('@/features/auth/GoogleAuthCallbackPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const ChangePasswordPage = lazy(() => import('@/features/auth/ChangePasswordPage'))
const LegalPage = lazy(() => import('@/features/legal/LegalPage'))
const NotFoundPage = lazy(() => import('@/features/errors/NotFoundPage'))
const LandingPage = lazy(() => import('@/features/landing/LandingPage'))
const ComponentGallery = lazy(() => import('@/features/dev/ComponentGallery'))

const PatientDashboardPage = lazy(() => import('@/features/patient/PatientDashboardPage'))
const AppointmentsPage = lazy(() => import('@/features/patient/AppointmentsPage'))
const BookAppointmentPage = lazy(() => import('@/features/patient/BookAppointmentPage'))
const ProgressPage = lazy(() => import('@/features/patient/ProgressPage'))
const DependentsPage = lazy(() => import('@/features/patient/DependentsPage'))
const DependentDetailPage = lazy(() => import('@/features/patient/DependentDetailPage'))
const ProfilePage = lazy(() => import('@/features/patient/PatientProfilePage'))
const PatientSettingsPage = lazy(() => import('@/features/patient/PatientSettingsPage'))
const AppointmentDetailsPage = lazy(() => import('@/features/patient/AppointmentDetailsPage'))
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'))

const AdminDashboardPage = lazy(() => import('@/features/admin/AdminDashboardPage'))
const AdminAppointmentsPage = lazy(() => import('@/features/admin/AppointmentsPage'))
const AdminPeoplePage = lazy(() => import('@/features/admin/PeoplePage'))
const AdminPaymentsPage = lazy(() => import('@/features/admin/PaymentsPage'))
const AdminReportsPage = lazy(() => import('@/features/admin/ReportsPage'))
const AdminServicesPage = lazy(() => import('@/features/admin/ServicesPage'))
const AdminSessionsPage = lazy(() => import('@/features/admin/SessionsPage'))
const AdminUsersPage = lazy(() => import('@/features/admin/UsersPage'))
const AdminSettingsPage = lazy(() => import('@/features/admin/settings/SettingsPage'))
const StaffDocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'))
const VerifyDocumentPage = lazy(() => import('@/features/documents/VerifyPage'))
const AdminProfilePage = lazy(() => import('@/features/admin/AdminProfilePage'))
const TherapistDashboardPage = lazy(() => import('@/features/therapist/TherapistDashboardPage'))
const TherapistAppointmentsPage = lazy(
  () => import('@/features/therapist/TherapistAppointmentsPage'),
)
const TherapistAvailabilityPage = lazy(
  () => import('@/features/therapist/TherapistAvailabilityPage'),
)
const TherapistPatientsPage = lazy(() => import('@/features/therapist/TherapistPatientsPage'))
const TherapistProfilePage = lazy(() => import('@/features/therapist/TherapistProfilePage'))
const TherapistRecordsPage = lazy(() => import('@/features/therapist/TherapistRecordsPage'))
const TherapistAppointmentDetailsPage = lazy(
  () => import('@/features/therapist/TherapistAppointmentDetailsPage'),
)
const TherapistSettingsPage = lazy(() => import('@/features/therapist/TherapistSettingsPage'))
const SecretaryDashboardPage = lazy(() => import('@/features/secretary/SecretaryDashboardPage'))
const SecretaryPaymentsPage = lazy(() => import('@/features/secretary/SecretaryPaymentsPage'))
const SecretaryProfilePage = lazy(() => import('@/features/secretary/SecretaryProfilePage'))
const SecretarySchedulePage = lazy(() => import('@/features/secretary/SecretarySchedulePage'))
const SecretarySettingsPage = lazy(() => import('@/features/secretary/SecretarySettingsPage'))

function lazyRoute(element: ReactElement) {
  return <Suspense fallback={<AppLoader />}>{element}</Suspense>
}

function shellRoute(element: ReactElement, variant: SkeletonVariant = 'table') {
  return <Suspense fallback={<PageSkeletonFallback variant={variant} />}>{element}</Suspense>
}

const staffRoles = ['admin', 'therapist', 'secretary']

function StaffDashboardRedirect() {
  const { user } = useAuth()
  return <Navigate replace to={`/staff/${user?.role}`} />
}

function StaffPaymentsPage() {
  const { user } = useAuth()
  return user?.role === 'admin'
    ? shellRoute(<AdminPaymentsPage />)
    : shellRoute(<SecretaryPaymentsPage />)
}

function StaffAppointmentsPage() {
  const { user } = useAuth()
  return user?.role === 'admin'
    ? shellRoute(<AdminAppointmentsPage />)
    : shellRoute(<TherapistAppointmentsPage />)
}

function NotificationsRedirect() {
  const { user } = useAuth()
  const role = user?.role === 'patient' ? 'dashboard' : `staff/${user?.role}`
  return <Navigate replace to={`/${role}/notifications`} />
}

const patientChildren: RouteObject[] = [
  { index: true, element: shellRoute(<PatientDashboardPage />, 'dashboard') },
  { path: 'appointments', element: shellRoute(<AppointmentsPage />) },
  { path: 'appointments/:id', element: shellRoute(<AppointmentDetailsPage />, 'form') },
  { path: 'book', element: shellRoute(<BookAppointmentPage />, 'form') },
  { path: 'progress', element: shellRoute(<ProgressPage />, 'dashboard') },
  { path: 'dependents', element: shellRoute(<DependentsPage />) },
  { path: 'dependents/:id', element: shellRoute(<DependentDetailPage />, 'form') },
  { path: 'notifications', element: shellRoute(<NotificationsPage />) },
]

const adminChildren: RouteObject[] = [
  { index: true, element: shellRoute(<AdminDashboardPage />, 'dashboard') },
  { path: 'users', element: shellRoute(<AdminUsersPage />) },
  { path: 'therapists', element: shellRoute(<AdminPeoplePage role="therapist" />) },
  { path: 'patients', element: shellRoute(<AdminPeoplePage role="patient" />) },
  { path: 'appointments', element: shellRoute(<AdminAppointmentsPage />) },
  { path: 'services', element: shellRoute(<AdminServicesPage />) },
  { path: 'sessions', element: shellRoute(<AdminSessionsPage />) },
  { path: 'payments', element: shellRoute(<AdminPaymentsPage />) },
  { path: 'reports', element: shellRoute(<AdminReportsPage />, 'dashboard') },
  { path: 'notifications', element: shellRoute(<NotificationsPage />) },
  { path: 'settings', element: shellRoute(<AdminSettingsPage />, 'form') },
  { path: 'profile', element: shellRoute(<AdminProfilePage />, 'form') },
]

const therapistChildren: RouteObject[] = [
  { index: true, element: shellRoute(<TherapistDashboardPage />, 'dashboard') },
  { path: 'my-appointments', element: shellRoute(<TherapistAppointmentsPage />) },
  { path: 'appointments/:id', element: shellRoute(<TherapistAppointmentDetailsPage />, 'form') },
  { path: 'my-patients', element: shellRoute(<TherapistPatientsPage />) },
  { path: 'session-records', element: shellRoute(<TherapistRecordsPage />) },
  { path: 'availability', element: shellRoute(<TherapistAvailabilityPage />, 'form') },
  { path: 'notifications', element: shellRoute(<NotificationsPage />) },
  { path: 'settings', element: shellRoute(<TherapistSettingsPage />, 'form') },
  { path: 'profile', element: shellRoute(<TherapistProfilePage />, 'form') },
]

const secretaryChildren: RouteObject[] = [
  { index: true, element: shellRoute(<SecretaryDashboardPage />, 'dashboard') },
  { path: 'schedule', element: shellRoute(<SecretarySchedulePage />) },
  { path: 'payments', element: shellRoute(<SecretaryPaymentsPage />) },
  { path: 'notifications', element: shellRoute(<NotificationsPage />) },
  { path: 'settings', element: shellRoute(<SecretarySettingsPage />, 'form') },
  { path: 'profile', element: shellRoute(<SecretaryProfilePage />, 'form') },
]

function createRoleRoutes(
  allowedRoles: string | string[],
  children: RouteObject[],
  layoutRole?: string,
): RouteObject {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  const layout = layoutRole !== undefined ? layoutRole : roles.length === 1 ? roles[0] : undefined
  return {
    element: <ProtectedRoute allowedRoles={roles} />,
    children: [
      {
        element: layout !== undefined ? <StaffLayout role={layout} /> : <StaffLayout />,
        children,
      },
    ],
  }
}

export const router = createBrowserRouter([
  { path: '/', element: lazyRoute(<LandingPage />) },
  { path: '/google/setup', element: lazyRoute(<GoogleAccountSetup />) },
  { path: '/auth/callback', element: lazyRoute(<GoogleAuthCallback />) },
  { path: '/reset-password', element: lazyRoute(<ResetPasswordPage />) },
  { path: '/staff/reset-password', element: lazyRoute(<ResetPasswordPage staff />) },
  { path: '/verify/:trackingNumber', element: lazyRoute(<VerifyDocumentPage />) },
  { path: '/terms', element: lazyRoute(<LegalPage />) },
  { path: '/privacy', element: lazyRoute(<LegalPage privacy />) },
  {
    path: '/staff/change-password',
    element: <ProtectedRoute allowedRoles={staffRoles} />,
    children: [{ index: true, element: lazyRoute(<ChangePasswordPage />) }],
  },
  {
    path: '/notifications',
    element: <ProtectedRoute allowedRoles={staffRoles.concat('patient')} />,
    children: [{ index: true, element: <NotificationsRedirect /> }],
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/auth', element: lazyRoute(<Auth />) },
      { path: '/login', element: lazyRoute(<Auth />) },
      { path: '/signup', element: lazyRoute(<Auth />) },
      { path: '/forgot-password', element: lazyRoute(<Auth />) },
      { path: '/staff/login', element: lazyRoute(<Auth />) },
      { path: '/staff/forgot-password', element: lazyRoute(<Auth />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['patient']} />,
    children: [
      {
        path: '/dashboard',
        element: <PatientLayout />,
        errorElement: <RouteErrorBoundary />,
        children: patientChildren,
      },
      {
        path: '/profile',
        element: <PatientLayout />,
        children: [{ index: true, element: shellRoute(<ProfilePage />, 'form') }],
      },
      {
        path: '/settings',
        element: <PatientLayout />,
        children: [{ index: true, element: shellRoute(<PatientSettingsPage />, 'form') }],
      },
      {
        path: '/dependents',
        element: <PatientLayout />,
        children: [
          { index: true, element: shellRoute(<DependentsPage />) },
          { path: ':id', element: shellRoute(<DependentDetailPage />, 'form') },
        ],
      },
    ],
  },
  {
    path: '/staff',
    element: <ProtectedRoute allowedRoles={staffRoles} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <StaffDashboardRedirect /> },
      { path: 'dashboard', element: <StaffDashboardRedirect /> },
      {
        path: 'payments',
        ...createRoleRoutes(
          ['admin', 'secretary'],
          [{ index: true, element: <StaffPaymentsPage /> }],
        ),
      },
      { path: 'admin', ...createRoleRoutes('admin', adminChildren) },
      {
        path: 'users',
        ...createRoleRoutes('admin', [{ index: true, element: shellRoute(<AdminUsersPage />) }]),
      },
      { path: 'therapist', ...createRoleRoutes('therapist', therapistChildren) },
      {
        path: 'appointments',
        ...createRoleRoutes(
          ['admin', 'therapist'],
          [
            { index: true, element: <StaffAppointmentsPage /> },
            { path: ':id', element: shellRoute(<TherapistAppointmentDetailsPage />, 'form') },
          ],
        ),
      },
      {
        path: 'patients',
        ...createRoleRoutes('therapist', [
          { index: true, element: shellRoute(<TherapistPatientsPage />) },
        ]),
      },
      {
        path: 'sessions',
        ...createRoleRoutes('therapist', [
          { index: true, element: shellRoute(<TherapistRecordsPage />) },
        ]),
      },
      {
        path: 'availability',
        ...createRoleRoutes('therapist', [
          { index: true, element: shellRoute(<TherapistAvailabilityPage />, 'form') },
        ]),
      },
      {
        path: 'documents',
        ...createRoleRoutes(
          ['admin', 'secretary', 'therapist'],
          [
            {
              index: true,
              element: (
                <AreaGuard area="documents">{shellRoute(<StaffDocumentsPage />)}</AreaGuard>
              ),
            },
          ],
        ),
      },
      { path: 'secretary', ...createRoleRoutes('secretary', secretaryChildren) },
      {
        path: 'schedule',
        ...createRoleRoutes('secretary', [
          { index: true, element: shellRoute(<SecretarySchedulePage />) },
        ]),
      },
      {
        path: 'profile',
        ...createRoleRoutes('secretary', [
          { index: true, element: shellRoute(<SecretaryProfilePage />, 'form') },
        ]),
      },
    ],
  },
  ...(import.meta.env.DEV
    ? [{ path: 'dev/components', element: lazyRoute(<ComponentGallery />) }]
    : []),
  { path: '*', element: lazyRoute(<NotFoundPage />) },
])

const pageTitles: [string, string][] = [
  ['/staff/admin/appointments', 'Appointments'],
  ['/staff/admin/users', 'User management'],
  ['/staff/admin/therapists', 'Therapist records'],
  ['/staff/admin/patients', 'Patient records'],
  ['/staff/admin/services', 'Therapy services'],
  ['/staff/admin/sessions', 'Session history'],
  ['/staff/admin/payments', 'Payments'],
  ['/staff/admin/reports', 'Reports'],
  ['/staff/admin/settings', 'Clinic settings'],
  ['/staff/documents', 'Documents'],
  ['/verify', 'Verify a document'],
  ['/staff/admin/profile', 'Profile'],
  ['/staff/admin', 'Clinic today'],
  ['/dashboard/appointments', 'My appointments'],
  ['/dashboard/book', 'Book an appointment'],
  ['/dashboard/progress', 'Therapy progress'],
  ['/dashboard/dependents', 'My dependents'],
  ['/dashboard', 'Dashboard'],
  ['/staff', 'Staff portal'],
  ['/login', 'Log in'],
  ['/signup', 'Sign up'],
  ['/forgot-password', 'Forgot password'],
  ['/reset-password', 'Reset password'],
  ['/staff/login', 'Staff login'],
]

function updateDocumentTitle(pathname: string) {
  const title = pageTitles.find(([path]) => pathname.startsWith(path))?.[1]
  document.title = `${title || 'Home'} | AbsoluteCare Therapy Center`
}

updateDocumentTitle(router.state.location.pathname)
router.subscribe(({ location }) => updateDocumentTitle(location.pathname))
