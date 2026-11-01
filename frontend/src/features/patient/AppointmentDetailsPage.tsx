import { ArrowLeft, CalendarDays, RefreshCw, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { appointmentDate, appointmentTime, therapistName } from '@/lib/format/patient'
import { showPromise } from '@/lib/toast'
import { therapistInitials } from './format'
import { useSyncCalendar } from './mutations'
import { useAppointment } from './queries'
import { RescheduleDialog } from './RescheduleDialog'

export default function AppointmentDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const appointmentQuery = useAppointment(id)
  const syncMutation = useSyncCalendar()
  const [rescheduling, setRescheduling] = useState(false)

  async function syncCalendar() {
    if (!id) return
    const request = syncMutation.mutateAsync(id)
    showPromise(request, {
      loading: 'Connecting appointment to Google Calendar...',
      success: 'Appointment added to Google Calendar.',
      error: "Couldn't sync this appointment to Google Calendar.",
    })
    try {
      await request
    } catch {}
  }

  if (appointmentQuery.isLoading) {
    return (
      <PageBody aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-24 rounded-lg" />
        <Skeleton className="mt-4 h-40 rounded-lg" />
      </PageBody>
    )
  }

  const appointment = appointmentQuery.data
  if (appointmentQuery.error || !appointment) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={22} />}
          title="Appointment unavailable"
          message={appointmentQuery.error?.message || 'We couldn’t find that appointment.'}
          action={
            <Button asChild>
              <Link to="/dashboard/appointments">Back to appointments</Link>
            </Button>
          }
        />
      </PageBody>
    )
  }

  const therapist = appointment.therapist
  const canReschedule =
    ['pending', 'confirmed'].includes(appointment.status) &&
    appointment.rescheduleRequest?.status !== 'requested'

  return (
    <PageBody>
      <Button variant="ghost" size="sm" className="-ml-2 mb-3" onClick={() => navigate(-1)}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to appointments
      </Button>

      <PageHeader
        eyebrow="Appointment details"
        title={appointment.service?.name || 'Therapy appointment'}
        actions={
          <StatusBadge
            status={
              appointment.rescheduleRequest?.status === 'requested'
                ? 'Reschedule requested'
                : appointment.status
            }
          />
        }
      />

      <dl className="mt-5 grid gap-4 rounded-lg border border-hairline bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-[11.5px] text-ink-faint">Date</dt>
          <dd className="mt-1 text-[14px] font-medium text-ink">{appointmentDate(appointment)}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-ink-faint">Time</dt>
          <dd className="mt-1 text-[14px] font-medium text-ink">{appointmentTime(appointment)}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-ink-faint">Duration</dt>
          <dd className="mt-1 text-[14px] font-medium text-ink">
            {appointment.service?.duration
              ? `${appointment.service.duration} minutes`
              : 'To be confirmed'}
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-ink-faint">Therapist</dt>
          <dd className="mt-1 text-[14px] font-medium text-ink">{therapistName(therapist)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-hairline bg-card p-5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary"
          aria-hidden="true"
        >
          {therapist ? therapistInitials(therapist) : <UserRound size={20} />}
        </span>
        <div className="min-w-0">
          <strong className="block text-[14px] text-ink">{therapistName(therapist)}</strong>
          <span className="text-[12.5px] text-ink-soft">
            {therapist?.specialization ||
              (therapist
                ? 'Physical therapist'
                : 'Your therapist will be assigned after confirmation')}
          </span>
        </div>
      </div>

      {appointment.notes ? (
        <div className="mt-4 rounded-lg border border-hairline bg-card p-5">
          <p className="text-[11.5px] text-ink-faint">Notes for the care team</p>
          <p className="mt-1 text-[13px] text-ink">{appointment.notes}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {canReschedule ? (
          <Button type="button" onClick={() => setRescheduling(true)}>
            Request reschedule
          </Button>
        ) : null}
        {appointment.status === 'confirmed' ? (
          appointment.googleEventLink ? (
            <Button asChild variant="outline">
              <a href={appointment.googleEventLink} target="_blank" rel="noreferrer">
                <CalendarDays size={15} aria-hidden="true" />
                Synced to Google Calendar
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void syncCalendar()}
              disabled={syncMutation.isPending}
            >
              <CalendarDays size={15} aria-hidden="true" />
              {syncMutation.isPending ? 'Syncing…' : 'Add to Google Calendar'}
            </Button>
          )
        ) : null}
      </div>

      <RescheduleDialog
        appointmentId={appointment._id}
        open={rescheduling}
        onOpenChange={setRescheduling}
      />
    </PageBody>
  )
}
