import { Outlet, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, UserRound, UserRoundCog } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/session'
import NotificationBell from '@/features/notifications/NotificationBell'
import { AppShell } from './AppShell'

const todayLabel = new Intl.DateTimeFormat('en-PH', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
}).format(new Date())

export default function PatientLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'AC'

  async function logOut() {
    await logout()
    navigate('/login')
  }

  return (
    <AppShell
      role="patient"
      context={todayLabel}
      actions={
        <>
          <NotificationBell role="patient" />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 items-center gap-2 rounded-md border border-transparent px-1.5 text-[12.5px] text-ink-soft transition-colors duration-150 ease-snap hover:bg-sunk hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
              aria-label="Profile menu"
            >
              {user?.profilePicture ? (
                <img
                  className="size-6 rounded-full object-cover"
                  src={user.profilePicture}
                  alt=""
                />
              ) : (
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-[10.5px] font-semibold text-primary-strong">
                  {initials}
                </span>
              )}
              <span className="max-[640px]:hidden">{user?.firstName || 'Patient'}</span>
              {user?.isGuardian ? (
                <span className="rounded-sm bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary-strong">
                  Guardian
                </span>
              ) : null}
              <ChevronDown className="size-3.5 text-ink-faint" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => navigate('/profile')}>
                <UserRound className="size-4" aria-hidden="true" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/settings')}>
                <UserRoundCog className="size-4" aria-hidden="true" />
                Settings
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
      <Outlet />
    </AppShell>
  )
}
