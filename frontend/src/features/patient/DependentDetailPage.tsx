import { ArrowLeft, CalendarPlus, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { appointmentDate, appointmentTime } from '@/lib/format/patient'
import { ageLabel, dateLabel, dependentName } from './format'
import { useDependent } from './queries'
import type { Appointment, SessionRecord } from './types'

export default function DependentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useDependent(id)

  if (query.isLoading) {
    return (
      <PageBody aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-24 rounded-lg" />
        <Skeleton className="mt-4 h-56 rounded-lg" />
      </PageBody>
    )
  }

  if (query.error || !query.data) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={22} />}
          title="We couldn’t load this dependent"
          message={query.error?.message || 'That dependent could not be found.'}
          action={
            <Button asChild>
              <Link to="/dashboard/dependents">Back to dependents</Link>
            </Button>
          }
        />
      </PageBody>
    )
  }

  const { dependent, appointments, sessions } = query.data
  const upcoming = appointments.filter(
    (appointment) =>
      appointment.status === 'confirmed' &&
      appointment.scheduledStart &&
      new Date(appointment.scheduledStart) >= new Date(),
  )
  const previous = appointments.filter((appointment) => !upcoming.includes(appointment))

  return (
    <PageBody>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-3"
        onClick={() => navigate('/dashboard/dependents')}
      >
        <ArrowLeft size={15} aria-hidden="true" /> My dependents
      </Button>

      <PageHeader
        eyebrow="Dependent profile"
        title={dependentName(dependent)}
        description={`${dependent.relationship || 'Family member'} · ${ageLabel(dependent.dateOfBirth)} · Born ${dateLabel(dependent.dateOfBirth)}`}
        actions={
          <Button asChild>
            <Link to={`/dashboard/book?dependent=${dependent._id}`}>
              <CalendarPlus size={16} aria-hidden="true" /> Book appointment
            </Link>
          </Button>
        }
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <AppointmentList
          title="Upcoming appointments"
          appointments={upcoming}
          empty="No upcoming appointments."
        />
        <AppointmentList
          title="Previous appointments"
          appointments={previous}
          empty="No previous appointments."
        />
        <SessionList sessions={sessions} />
      </div>
    </PageBody>
  )
}

function AppointmentList({
  title,
  appointments,
  empty,
}: {
  title: string
  appointments: Appointment[]
  empty: string
}) {
  return (
    <section className="rounded-lg border border-hairline bg-card p-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {appointments.length ? (
        <ul className="mt-3 grid gap-2.5">
          {appointments.map((appointment) => (
            <li
              key={appointment._id}
              className="border-t border-hairline-in pt-2.5 first:border-t-0 first:pt-0"
            >
              <strong className="block text-[13px] text-ink">{appointmentDate(appointment)}</strong>
              <span className="block text-[12px] text-ink-soft">
                {appointmentTime(appointment)} · {appointment.service?.name || 'Therapy'}
              </span>
              <StatusBadge status={appointment.status} className="mt-1" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12.5px] text-ink-soft">{empty}</p>
      )}
    </section>
  )
}

function SessionList({ sessions }: { sessions: SessionRecord[] }) {
  return (
    <section className="rounded-lg border border-hairline bg-card p-5">
      <h2 className="text-[15px] font-semibold text-ink">Session history</h2>
      {sessions.length ? (
        <ul className="mt-3 grid gap-2.5">
          {sessions.map((session) => (
            <li
              key={session._id}
              className="border-t border-hairline-in pt-2.5 first:border-t-0 first:pt-0"
            >
              <strong className="block text-[13px] text-ink">
                {dateLabel(session.sessionDate)}
              </strong>
              <span className="block text-[12px] text-ink-soft">
                {session.service?.name || 'Therapy session'}
              </span>
              <small className="block text-[11.5px] text-ink-faint">
                {session.patientVisibleNotes || 'Session notes are available in your records.'}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12.5px] text-ink-soft">No sessions yet.</p>
      )}
    </section>
  )
}
