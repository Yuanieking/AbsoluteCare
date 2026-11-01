import { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, LogOut, Settings2, UserRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/session'
import NotificationBell from '@/features/notifications/NotificationBell'
import { listAppointments } from '@/features/therapist/api'
import { AppShell } from './AppShell'
import { getStaffRole, getStaffRoute, type StaffRoleKey } from './staff-roles'

type AssignedAppointment = { status?: string; scheduledStart?: string }

export default function StaffLayout({ role: routeRole }: { role?: string }) {
  const { role: paramRole } = useParams()
  const { user, loading: authLoading, logout } = useAuth()
  const role = user?.role || routeRole || paramRole
  const roleConfig = getStaffRole(role)
  const navigate = useNavigate()
  const [currentTime] = useState(() => Date.now())
  const [assignedAppointmentsState, setAssignedAppointments] = useState<
    AssignedAppointment[] | null
  >(role === 'therapist' && user?.id ? null : [])

  useEffect(() => {
    if (role !== 'therapist' || !user?.id) return
    listAppointments()
      .then((appointments) =>
        setAssignedAppointments(
          appointments.map((appointment) => ({
            status: appointment.status,
            scheduledStart: appointment.scheduledStart ?? undefined,
          })),
        ),
      )
      .catch(() => setAssignedAppointments([]))
  }, [role, user?.id])

  const assignedAppointments = useMemo(
    () => assignedAppointmentsState || [],
    [assignedAppointmentsState],
  )
  const appointmentsLoading = role === 'therapist' && assignedAppointmentsState === null

  const activeUpcomingAppointments = useMemo(
    () =>
      assignedAppointments.filter((item) => {
        const status = item.status?.toLowerCase?.() || ''
        return (
          status === 'confirmed' &&
          Boolean(item.scheduledStart) &&
          new Date(item.scheduledStart as string).getTime() >= currentTime
        )
      }),
    [assignedAppointments, currentTime],
  )

  const firstName = user?.firstName || ''
  const lastName = user?.lastName || ''
  const displayName = `${firstName} ${lastName}`.trim()
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '…'
  const picture = typeof user?.profilePicture === 'string' ? user.profilePicture : undefined
  const profilePath = getStaffRoute((role ?? 'secretary') as StaffRoleKey, 'profile')

  async function logOut() {
    await logout()
    navigate('/staff/login')
  }

  return (
    <AppShell
      role={String(role ?? 'secretary')}
      context={roleConfig.label}
      badges={appointmentsLoading ? {} : { appointments: activeUpcomingAppointments.length > 0 }}
      actions={
        <>
          <NotificationBell role={String(role ?? 'secretary')} />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 items-center gap-2 rounded-md border border-transparent px-1.5 text-[12.5px] text-ink-soft transition-colors duration-150 ease-snap hover:bg-sunk hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
              aria-label="Staff profile menu"
            >
              <span className="inline-flex size-6 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-[10.5px] font-semibold text-primary-strong">
                {picture ? (
                  <img src={picture} alt="" className="size-full object-cover" />
                ) : authLoading ? (
                  <span className="size-full bg-sunk" aria-hidden="true" />
                ) : (
                  initials
                )}
              </span>
              <span className="max-[640px]:hidden">
                {authLoading ? 'Loading profile' : displayName || 'Staff member'}
              </span>
              <ChevronDown className="size-3.5 text-ink-faint" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => navigate(profilePath)}>
                <UserRound className="size-4" aria-hidden="true" />
                View profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`${profilePath}?edit=1`)}>
                <Settings2 className="size-4" aria-hidden="true" />
                Edit profile
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => void logOut()}>
                <LogOut className="size-4" aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <Outlet
        context={{
          role,
          roleConfig,
          assignedAppointments,
          activeUpcomingAppointments,
          appointmentsLoading,
        }}
      />
    </AppShell>
  )
}
