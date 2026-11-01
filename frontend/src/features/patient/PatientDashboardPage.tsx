import { ArrowUpRight, CalendarCheck2, CalendarPlus, Phone, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppointmentDocket } from '@/components/domain/AppointmentDocket'
import { StatTile } from '@/components/domain/StatTile'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/session'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import {
  appointmentDate,
  appointmentTime,
  formatAppointmentDate,
  therapistName,
} from '@/lib/format/patient'
import {
  ageLabel,
  buildWeek,
  dependentName,
  initials,
  monthlySessionSeries,
  nextVisitLabel,
  therapistInitials,
} from './format'
import { useAppointments, useDependents, useSessions } from './queries'
import type { Appointment, Dependent, PatientProfile, SessionRecord } from './types'

const todayLabel = new Intl.DateTimeFormat('en-PH', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date())

export default function PatientDashboardPage() {
  const { user } = useAuth()
  const profile = user as PatientProfile | null
  const pending = useAppointments('pending')
  const upcoming = useAppointments('upcoming')
  const sessions = useSessions()
  const dependents = useDependents()

  const loading =
    pending.isLoading || upcoming.isLoading || sessions.isLoading || dependents.isLoading
  const showSkeleton = useDelayedLoading(loading)
  const error =
    pending.error?.message ||
    upcoming.error?.message ||
    sessions.error?.message ||
    dependents.error?.message ||
    ''

  function retry() {
    void pending.refetch()
    void upcoming.refetch()
    void sessions.refetch()
    void dependents.refetch()
  }

  if (loading && showSkeleton) return <DashboardSkeleton />
  if (loading) {
    return (
      <PageBody>
        <p className="sr-only" role="status">
          Loading your dashboard
        </p>
      </PageBody>
    )
  }
  if (error) return <DashboardError message={error} retry={retry} />

  const appointmentList = upcoming.data?.appointments ?? []
  const sessionHistory = sessions.data ?? []
  const dependentsList = dependents.data ?? []
  const upcomingAppointment = appointmentList[0] ?? null
  const pendingCount = pending.data?.total ?? 0
  const firstName = profile?.firstName || 'there'

  return (
    <PageBody>
      <PageHeader
        eyebrow={todayLabel}
        title={`Welcome back, ${firstName}.`}
        description="Here is your care plan at a glance."
        actions={
          <Button asChild>
            <Link to="/dashboard/book">
              <CalendarPlus size={16} aria-hidden="true" />
              Book a visit
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <AppointmentDocket appointment={upcomingAppointment} />
        <div className="grid gap-3">
          <StatTile
            label="Sessions completed"
            value={sessionHistory.length}
            caption={
              sessionHistory.length
                ? 'Every completed visit is in your progress history.'
                : 'Your first completed visit will appear here.'
            }
            href="/dashboard/progress"
            series={monthlySessionSeries(sessionHistory)}
            seriesType="area"
          />
          <StatTile
            label="Requests awaiting confirmation"
            value={pendingCount}
            caption={
              pendingCount
                ? 'The clinic is reviewing these now.'
                : 'Nothing is waiting on the clinic.'
            }
            href="/dashboard/appointments"
          />
        </div>
      </div>

      <WeekRail appointments={appointmentList} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <ActivityCard sessions={sessionHistory.slice(0, 3)} />
        <div className="grid content-start gap-4">
          <CareTeamCard appointment={upcomingAppointment} />
          <DependentsCard dependents={dependentsList} />
        </div>
      </div>
    </PageBody>
  )
}

function WeekRail({ appointments }: { appointments: Appointment[] }) {
  const week = buildWeek(appointments)
  const hasVisits = week.some((day) => day.hasVisit)

  return (
    <section aria-label="Your next seven days" className="mt-4">
      <ol className="grid grid-cols-7 overflow-hidden rounded-lg border border-hairline-in bg-card">
        {week.map((day) => (
          <li
            key={day.key}
            className={[
              'flex flex-col items-center gap-1 border-r border-hairline-in py-2.5 last:border-r-0',
              day.isToday ? 'bg-primary-soft' : day.isWeekend ? 'bg-sunk/60' : 'bg-card',
            ].join(' ')}
          >
            <span className="text-[10.5px] font-medium text-ink-faint">
              {day.isToday ? 'Today' : day.weekday}
            </span>
            <span className="font-display text-[15px] font-semibold tabular-nums text-ink">
              {day.day}
            </span>
            <span
              className={`size-1.5 rounded-full ${day.hasVisit ? 'bg-primary' : 'bg-hairline'}`}
              aria-hidden="true"
            />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-ink-soft">
        {hasVisits ? 'Visits this week' : 'No visits this week'}
      </p>
    </section>
  )
}

function ActivityCard({ sessions }: { sessions: SessionRecord[] }) {
  return (
    <section
      aria-labelledby="activity-title"
      className="rounded-lg border border-hairline bg-card p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium text-ink-faint">Your care</p>
          <h2
            id="activity-title"
            className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-ink"
          >
            Recent activity
          </h2>
        </div>
        <Link
          to="/dashboard/progress"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
        >
          All sessions <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </header>
      {sessions.length ? (
        <ul className="mt-4 grid gap-3">
          {sessions.map((session) => (
            <li
              key={session._id}
              className="flex gap-3 border-t border-hairline-in pt-3 first:border-t-0 first:pt-0"
            >
              <span className="mt-0.5 text-ink-faint" aria-hidden="true">
                <CalendarCheck2 size={15} />
              </span>
              <div className="min-w-0">
                <strong className="block text-[13px] text-ink">
                  {formatAppointmentDate(session.sessionDate)}
                </strong>
                <span className="text-[12px] text-ink-soft">
                  {session.service?.name || 'Therapy session'} · {therapistName(session.therapist)}
                </span>
                <p className="mt-1 text-[12.5px] text-ink-soft">
                  {session.patientVisibleNotes || 'Session completed.'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CalendarCheck2 size={19} />}
          title="No sessions yet"
          message="Completed visits and your therapist's notes will appear here."
        />
      )}
    </section>
  )
}

function CareTeamCard({ appointment }: { appointment: Appointment | null }) {
  const therapist = appointment?.therapist
  return (
    <section
      aria-labelledby="care-team-title"
      className="rounded-lg border border-hairline bg-card p-5"
    >
      <p className="text-[11.5px] font-medium text-ink-faint">Your care team</p>
      <h2
        id="care-team-title"
        className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-ink"
      >
        Who you will see
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary"
          aria-hidden="true"
        >
          {therapistInitials(therapist) || 'AC'}
        </span>
        <div className="min-w-0">
          <strong className="block text-[13px] text-ink">{therapistName(therapist)}</strong>
          <span className="text-[12px] text-ink-soft">
            {appointment?.service?.name || 'Therapy'} at AbsoluteCare
          </span>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 border-t border-hairline-in pt-3 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-faint">Next visit</dt>
          <dd className="text-right text-ink">
            {appointment
              ? `${appointmentDate(appointment)} · ${appointmentTime(appointment)}`
              : 'Not scheduled'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-faint">Clinic</dt>
          <dd className="text-ink">Malaybalay City</dd>
        </div>
      </dl>
      <a
        href="tel:09177152780"
        className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
      >
        <Phone size={14} aria-hidden="true" />
        Call the clinic
      </a>
    </section>
  )
}

function DependentsCard({ dependents }: { dependents: Dependent[] }) {
  return (
    <section
      aria-labelledby="dependents-title"
      className="rounded-lg border border-hairline bg-card p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium text-ink-faint">For your family</p>
          <h2
            id="dependents-title"
            className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-ink"
          >
            Dependents
          </h2>
        </div>
        <Link
          to="/dashboard/dependents"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
        >
          Manage <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </header>
      {dependents.length ? (
        <ul className="mt-3 grid gap-2.5">
          {dependents.slice(0, 3).map((dependent) => (
            <li key={dependent._id} className="flex items-center gap-3">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunk text-[11px] font-semibold text-ink-soft"
                aria-hidden="true"
              >
                {initials(dependent.firstName, dependent.lastName)}
              </span>
              <div className="min-w-0">
                <strong className="block text-[13px] text-ink">{dependentName(dependent)}</strong>
                <span className="text-[11.5px] text-ink-soft">
                  {ageLabel(dependent.dateOfBirth)} · {nextVisitLabel(dependent)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12.5px] text-ink-soft">
          Add a child profile when you manage care for someone else.
        </p>
      )}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <PageBody aria-busy="true">
      <div className="grid gap-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-64 rounded-lg" />
          <div className="grid gap-3">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-16 rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      </div>
      <p className="sr-only" role="status">
        Loading your dashboard
      </p>
    </PageBody>
  )
}

function DashboardError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <PageBody>
      <EmptyState
        icon={<RefreshCw size={19} />}
        title="We couldn’t load your dashboard"
        message={message}
        action={
          <Button type="button" onClick={retry}>
            Try again
          </Button>
        }
      />
    </PageBody>
  )
}
