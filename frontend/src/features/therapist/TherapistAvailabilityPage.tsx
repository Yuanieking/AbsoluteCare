import { CalendarDays, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { WeeklyAvailabilityEditor } from '@/components/availability/WeeklyAvailabilityEditor'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatSchedule, scheduleErrors, scheduleOf, schedulePayload } from '@/lib/availability'
import { showError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { getCalendarConnectUrl } from './api'
import { useDisconnectCalendar, useSaveAvailability } from './mutations'
import { useTherapistCalendarStatus, useTherapistProfile } from './queries'
import type { CalendarStatus, TherapistProfile } from './types'

type Conflict = {
  appointmentId: string
  patientName: string
  startsAt: string
  endsAt: string
  reason: string
}

const conflictReasons: Record<string, string> = {
  day_not_available: 'Falls on a day you no longer work',
  before_opening: 'Starts before your opening time',
  after_closing: 'Ends after your closing time',
}

const conflictTime = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
})

function conflictOf(error: unknown): { message: string; conflicts: Conflict[] } | null {
  const data = (
    error as { response?: { data?: { message?: string; conflicts?: Conflict[] } } } | null
  )?.response?.data
  return data?.conflicts?.length
    ? {
        message: data.message || 'Some appointments fall outside this schedule.',
        conflicts: data.conflicts,
      }
    : null
}

export default function TherapistAvailabilityPage() {
  const profile = useTherapistProfile()

  if (profile.isLoading) {
    return (
      <PageBody aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-56 rounded-lg" />
        <p className="sr-only" role="status">
          Loading availability
        </p>
      </PageBody>
    )
  }

  if (profile.error || !profile.data) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={20} />}
          title="We couldn’t load your availability"
          message={profile.error?.message || 'Your profile could not be loaded.'}
          action={
            <Button type="button" onClick={() => void profile.refetch()}>
              Try again
            </Button>
          }
        />
      </PageBody>
    )
  }

  return <AvailabilityPanel profile={profile.data} />
}

function AvailabilityPanel({ profile }: { profile: TherapistProfile }) {
  const calendar = useTherapistCalendarStatus()
  const saveMutation = useSaveAvailability()
  const disconnectMutation = useDisconnectCalendar()

  const initial = scheduleOf(profile)
  const [days, setDays] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [summary, setSummary] = useState('')
  const [conflicts, setConflicts] = useState<{ message: string; conflicts: Conflict[] } | null>(
    null,
  )
  const [savedNotice, setSavedNotice] = useState(false)

  const isDirty = JSON.stringify(days) !== JSON.stringify(saved)
  const rowErrors = scheduleErrors(days)

  function edit(next: typeof days) {
    setDays(next)
    setSummary('')
    setSavedNotice(false)
  }

  function focusFirstInvalid(issues: Record<string, string>) {
    const day = Object.keys(issues)[0]
    if (!day) return
    document.getElementById(`therapist-availability-${day}-end`)?.focus()
  }

  async function save() {
    if (!days.length) {
      setSummary(
        'Choose at least one working day. Until you do, the clinic can schedule you at any time.',
      )
      return
    }
    if (Object.keys(rowErrors).length) {
      setSummary('Correct the highlighted times before saving.')
      focusFirstInvalid(rowErrors)
      return
    }
    setSummary('')
    setConflicts(null)
    try {
      const updated = await saveMutation.mutateAsync(schedulePayload(days))
      const next = scheduleOf(updated)
      setDays(next)
      setSaved(next)
      setSavedNotice(true)
    } catch (error) {
      const conflict = conflictOf(error)
      if (conflict) setConflicts(conflict)
      else
        showError(
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message,
        )
    }
  }

  async function disconnect() {
    try {
      await disconnectMutation.mutateAsync()
    } catch {
      showError('Couldn’t disconnect Google Calendar.')
    }
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="My care desk"
        title="My availability"
        description="Choose the days you work and the hours you can take appointments on each."
        actions={
          <>
            {isDirty ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDays(saved)
                  setSummary('')
                  setConflicts(null)
                }}
                disabled={saveMutation.isPending}
              >
                Discard
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!isDirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save schedule'}
            </Button>
          </>
        }
      />

      <section
        aria-labelledby="weekly-schedule"
        className={cn(
          'mt-5 rounded-lg border p-5 transition-colors duration-150',
          savedNotice && !isDirty
            ? 'border-primary/35 bg-primary-soft/25'
            : 'border-hairline bg-card',
        )}
      >
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 id="weekly-schedule" className="text-[15px] font-semibold text-ink">
              Weekly schedule
            </h2>
            <p className="text-[12.5px] text-ink-soft">
              {days.length
                ? formatSchedule(days)
                : 'No working days yet. Until you choose some, the clinic can schedule you at any time.'}
            </p>
          </div>
          <span className="text-[11.5px] text-ink-faint">Asia/Manila</span>
        </header>

        <div className="mt-4">
          <WeeklyAvailabilityEditor
            value={days}
            onChange={edit}
            errors={rowErrors}
            disabled={saveMutation.isPending}
            idPrefix="therapist-availability"
          />
        </div>

        <div className="mt-4 border-t border-hairline-in pt-3">
          {summary ? (
            <p role="alert" className="text-[12px] text-destructive">
              {summary}
            </p>
          ) : savedNotice && !isDirty ? (
            <p role="status" className="text-[12px] text-ink-soft">
              Schedule saved.
            </p>
          ) : (
            <p className="text-[12px] text-ink-faint">
              Saving is blocked while a pending or confirmed appointment sits outside the new hours.
            </p>
          )}
        </div>

        {conflicts ? (
          <div
            role="alert"
            className="mt-3 rounded-md border border-destructive/35 bg-destructive-soft/60 p-3"
          >
            <p className="text-[12.5px] font-medium text-destructive">{conflicts.message}</p>
            <ul className="mt-2 grid gap-1.5">
              {conflicts.conflicts.map((conflict) => (
                <li key={conflict.appointmentId} className="text-[12px] text-ink">
                  <a
                    href={`/staff/therapist/appointments/${conflict.appointmentId}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {conflict.patientName}
                  </a>{' '}
                  · {conflictTime.format(new Date(conflict.startsAt))} ·{' '}
                  <span className="text-ink-soft">
                    {conflictReasons[conflict.reason] || conflict.reason}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-ink-soft">
              Reschedule or cancel these with the clinic, then save again.
            </p>
          </div>
        ) : null}
      </section>

      <CalendarCard
        status={calendar.data}
        isLoading={calendar.isLoading}
        error={calendar.error?.message}
        disconnecting={disconnectMutation.isPending}
        onDisconnect={() => void disconnect()}
      />
    </PageBody>
  )
}

function CalendarCard({
  status,
  isLoading,
  error,
  disconnecting,
  onDisconnect,
}: {
  status?: CalendarStatus
  isLoading: boolean
  error?: string
  disconnecting: boolean
  onDisconnect: () => void
}) {
  const connected = status?.connected ?? false

  return (
    <section
      aria-labelledby="calendar-sync"
      className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-hairline-in bg-card px-4 py-3"
    >
      <span className="text-ink-faint" aria-hidden="true">
        <CalendarDays size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="calendar-sync" className="text-[13px] font-medium text-ink">
          Google Calendar
        </h2>
        <p className="text-[11.5px] text-ink-soft">
          {isLoading
            ? 'Checking connection…'
            : connected
              ? `Confirmed visits are copied to ${status?.email || 'your calendar'}.`
              : 'Not connected. Confirmed visits stay in AbsoluteCare only.'}
        </p>
        {error ? <p className="mt-0.5 text-[11.5px] text-destructive">{error}</p> : null}
      </div>
      {connected ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disconnecting}
          onClick={onDisconnect}
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <a href={getCalendarConnectUrl()}>Connect</a>
        </Button>
      )}
    </section>
  )
}
