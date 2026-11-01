import { CalendarDays, LockKeyhole } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificationPreferencesCard } from '@/features/notifications/NotificationPreferencesCard'
import { showError, showPromise, showSuccess } from '@/lib/toast'
import { getCalendarConnectUrl } from './api'
import { useDisconnectCalendar } from './mutations'
import { useCalendarStatus } from './queries'

export default function PatientSettingsPage() {
  const [searchParams] = useSearchParams()
  const calendar = useCalendarStatus()
  const disconnectMutation = useDisconnectCalendar()

  useEffect(() => {
    const result = searchParams.get('calendar')
    if (result === 'connected') showSuccess('Google Calendar connected.')
    if (result === 'error') showError('Google Calendar could not be connected. Try again.')
  }, [searchParams])

  async function disconnect() {
    const request = disconnectMutation.mutateAsync()
    showPromise(request, {
      loading: 'Disconnecting Google Calendar...',
      success: 'Google Calendar disconnected.',
      error: "Couldn't disconnect Google Calendar.",
    })
    try {
      await request
    } catch {}
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Your account"
        title="Settings"
        description="Choose how the clinic reaches you and which calendar receives confirmed visits."
      />

      <div className="mt-5 grid gap-4">
        <section className="rounded-lg border border-hairline bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-ink-faint" aria-hidden="true">
              <LockKeyhole size={18} />
            </span>
            <div>
              <strong className="text-[13.5px] text-ink">Change password</strong>
              <p className="text-[12.5px] text-ink-soft">Update the password you use to sign in.</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="ml-auto">
              Change
            </Button>
          </div>
        </section>

        <NotificationPreferencesCard />

        <section className="rounded-lg border border-hairline bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-ink-faint" aria-hidden="true">
              <CalendarDays size={18} />
            </span>
            <div className="min-w-0">
              <strong className="text-[13.5px] text-ink">Google Calendar</strong>
              <p className="text-[12.5px] text-ink-soft">
                Sync confirmed AbsoluteCare appointments to your calendar. Pending requests are
                never synced.
              </p>
              {calendar.data?.connected ? (
                <small className="mt-1 block text-[11.5px] text-ink-faint">
                  Connected{calendar.data.email ? ` · ${calendar.data.email}` : ''}
                </small>
              ) : null}
              {calendar.error ? (
                <small className="mt-1 block text-[11.5px] text-destructive">
                  {calendar.error.message}
                </small>
              ) : null}
            </div>
            {calendar.isLoading ? (
              <Skeleton className="ml-auto h-8 w-24" />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={disconnectMutation.isPending}
                onClick={() => {
                  if (calendar.data?.connected) void disconnect()
                  else window.location.href = getCalendarConnectUrl()
                }}
              >
                {calendar.data?.connected ? 'Disconnect' : 'Connect'}
              </Button>
            )}
          </div>
        </section>
      </div>
    </PageBody>
  )
}
