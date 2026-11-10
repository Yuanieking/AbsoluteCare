import { CalendarDays, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChartCard } from '@/components/domain/ChartCard'
import { StatTile } from '@/components/domain/StatTile'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { formatDateManila } from '@/lib/format/patient'
import {
  appointmentTimeLabel,
  nextVisit,
  patientName,
  serviceName,
  sessionSeries,
  todaysSchedule,
} from './format'
import { useTherapistAppointments, useTherapistPatients, useTherapistSessions } from './queries'

export default function TherapistDashboardPage() {
  const appointments = useTherapistAppointments()
  const patients = useTherapistPatients()
  const sessions = useTherapistSessions()

  const loading = appointments.isLoading || patients.isLoading || sessions.isLoading
  const showSkeleton = useDelayedLoading(loading)
  const error =
    appointments.error?.message || patients.error?.message || sessions.error?.message || ''

  function retry() {
    void appointments.refetch()
    void patients.refetch()
    void sessions.refetch()
  }

  if (loading && showSkeleton) return <DashboardSkeleton />
  if (loading) {
    return (
      <PageBody>
        <p className="sr-only" role="status">
          Loading your care desk
        </p>
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={19} />}
          title="We couldn’t load your care desk"
          message={error}
          action={
            <Button type="button" onClick={retry}>
              Try again
            </Button>
          }
        />
      </PageBody>
    )
  }

  const records = appointments.data ?? []
  const today = new Date()
  const schedule = todaysSchedule(records, today)
  const next = nextVisit(schedule, today)
  const confirmedAhead = records.filter(
    (item) =>
      item.status?.toLowerCase() === 'confirmed' &&
      (!item.scheduledStart || new Date(item.scheduledStart) >= today),
  ).length
  const recordsToComplete = records.filter(
    (item) =>
      item.status?.toLowerCase() === 'confirmed' &&
      item.scheduledStart &&
      new Date(item.scheduledStart) < today,
  ).length
  const sessionHistory = sessions.data ?? []
  const series = sessionSeries(sessionHistory, today)

  const caption = next
    ? `Next: ${appointmentTimeLabel(next)} · ${patientName(next)}`
    : schedule.length
      ? 'Visits are booked for today'
      : 'No visits today'

  return (
    <PageBody>
      <PageHeader
        eyebrow={formatDateManila(today).toUpperCase()}
        title="Your care desk"
        description="See your schedule, caseload and session records in one place."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Today's appointments"
          value={schedule.length}
          caption={caption}
          action="Open schedule"
          href="/staff/therapist/my-appointments?tab=upcoming"
        />
        <StatTile
          label="Upcoming appointments"
          value={confirmedAhead}
          caption="Confirmed visits ahead of you."
          action="View appointments"
          href="/staff/therapist/my-appointments?tab=upcoming"
        />
        <StatTile
          label="Assigned patients"
          value={patients.data?.length ?? 0}
          caption="On your caseload."
          action="View patients"
          href="/staff/therapist/my-patients"
        />
        <StatTile
          label="Records to complete"
          value={recordsToComplete}
          caption={
            recordsToComplete
              ? 'Past visits still needing your notes.'
              : 'Every past visit has notes.'
          }
          action="Record sessions"
          href="/staff/therapist/session-records"
          className={recordsToComplete ? 'border-signal/25 bg-signal-soft' : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="schedule-title"
          className="rounded-lg border border-hairline bg-card p-5"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11.5px] font-medium text-ink-faint">Today</p>
              <h2
                id="schedule-title"
                className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-ink"
              >
                Today&apos;s schedule
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft">
                The visits assigned to your care today.
              </p>
            </div>
            <Link
              to="/staff/therapist/my-appointments"
              className="text-[12.5px] font-medium text-primary hover:underline"
            >
              All appointments
            </Link>
          </header>

          {schedule.length ? (
            <ol className="mt-4 divide-y divide-hairline-in">
              {schedule.map((item) => {
                const isNext = item._id === next?._id
                return (
                  <li
                    key={item._id}
                    className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="w-16 shrink-0 text-[12.5px] font-medium tabular-nums text-ink-soft">
                      {appointmentTimeLabel(item)}
                    </span>
                    <Link
                      to={`/staff/therapist/appointments/${item._id}`}
                      className="min-w-0 flex-1 rounded-sm"
                    >
                      <strong className="block truncate text-[13px] text-ink">
                        {patientName(item)}
                      </strong>
                      <span className="block truncate text-[12px] text-ink-soft">
                        {serviceName(item)}
                      </span>
                    </Link>
                    {isNext ? (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                        Next
                      </span>
                    ) : (
                      <StatusBadge status={item.status} />
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <EmptyState
              icon={<CalendarDays size={19} />}
              title="No appointments today"
              message="Your next confirmed visit will appear here."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/staff/therapist/my-appointments?tab=upcoming">
                    View upcoming appointments
                  </Link>
                </Button>
              }
            />
          )}
          <p className="mt-3 text-[11px] text-ink-soft">All times in Asia/Manila</p>
        </section>

        <ChartCard
          title="Session load"
          subtitle="Sessions recorded per month, last 6 months"
          state={series.some((point) => point.value > 0) ? 'ready' : 'empty'}
          emptyMessage="Recorded sessions appear here as you close out visits."
          height={220}
        >
          <SessionLoadBars series={series} />
        </ChartCard>
      </div>
    </PageBody>
  )
}

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return MONTH_FORMAT.format(new Date(Date.UTC(year, month - 1, 1)))
}

/** Labeled columns: each bar shows its session count above and its month below. */
function SessionLoadBars({ series }: { series: { label: string; value: number }[] }) {
  const max = Math.max(...series.map((point) => point.value), 1)
  return (
    <ul className="flex h-[220px] items-end gap-2" aria-label="Recorded sessions per month">
      {series.map((point) => (
        <li key={point.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
          <div className="flex h-[170px] flex-col justify-end gap-1">
            <span className="text-center text-[12px] font-medium tabular-nums text-ink">
              {point.value}
            </span>
            <span
              aria-hidden="true"
              className="block w-full rounded-t-[3px]"
              style={{
                height: `${Math.max((point.value / max) * 140, point.value ? 4 : 1)}px`,
                background: 'var(--color-chart-1)',
              }}
            />
          </div>
          <span className="text-center text-[11.5px] text-ink-soft">{monthLabel(point.label)}</span>
        </li>
      ))}
    </ul>
  )
}

function DashboardSkeleton() {
  return (
    <PageBody aria-busy="true">
      <div className="grid gap-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
      <p className="sr-only" role="status">
        Loading your care desk
      </p>
    </PageBody>
  )
}
