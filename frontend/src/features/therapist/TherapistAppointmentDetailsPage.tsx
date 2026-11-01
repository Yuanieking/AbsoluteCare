import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NoShowDialog, RecordSessionDialog, RescheduleDialog } from './AppointmentDialogs'
import {
  appointmentLabel,
  canRecordOutcome,
  canRequestReschedule,
  openRescheduleRequest,
  patientName,
  personName,
  serviceName,
} from './format'
import { useTherapistAppointment } from './queries'

export default function TherapistAppointmentDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useTherapistAppointment(id)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [noShowOpen, setNoShowOpen] = useState(false)

  const appointment = query.data ?? null
  const requested = openRescheduleRequest(appointment)

  if (query.isLoading) {
    return (
      <PageBody aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-40 rounded-lg" />
        <p className="sr-only" role="status">
          Loading appointment
        </p>
      </PageBody>
    )
  }

  if (query.error || !appointment) {
    return (
      <PageBody>
        <EmptyState
          icon={<RefreshCw size={20} />}
          title="Appointment unavailable"
          message={query.error?.message || 'This appointment could not be found on your caseload.'}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/staff/therapist/my-appointments">Back to appointments</Link>
              </Button>
              <Button type="button" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          }
        />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Appointment details"
        title={patientName(appointment)}
        description={serviceName(appointment)}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/staff/therapist/my-appointments')}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to appointments
          </Button>
        }
      />

      <section className="mt-4 rounded-lg border border-hairline bg-card p-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <Detail label="Date and time" value={appointmentLabel(appointment)} />
          <div>
            <dt className="text-[11.5px] text-ink-faint">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={appointment.status} />
            </dd>
          </div>
          <Detail
            label="Duration"
            value={`${appointment.service?.duration ?? appointment.serviceSnapshot?.duration ?? 60} minutes`}
          />
          <Detail label="Patient email" value={appointment.patient?.email || 'Not provided'} />
          {appointment.dependent ? (
            <Detail label="Dependent" value={personName(appointment.dependent)} />
          ) : null}
          {appointment.patient?.phone ? (
            <Detail label="Patient phone" value={appointment.patient.phone} />
          ) : null}
          {appointment.notes ? <Detail label="Request notes" value={appointment.notes} /> : null}
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline-in pt-4">
          {requested ? (
            <p className="text-[12.5px] text-signal">
              Reschedule requested for {requested} — awaiting admin
            </p>
          ) : canRequestReschedule(appointment) ? (
            <Button type="button" variant="outline" onClick={() => setRescheduleOpen(true)}>
              Request reschedule
            </Button>
          ) : null}
          {canRecordOutcome(appointment) ? (
            <>
              <Button type="button" onClick={() => setSessionOpen(true)}>
                Record session
              </Button>
              <Button type="button" variant="outline" onClick={() => setNoShowOpen(true)}>
                Mark no-show
              </Button>
            </>
          ) : appointment.status?.toLowerCase() === 'confirmed' ? (
            <Button
              type="button"
              variant="outline"
              disabled
              title="Available once the session starts"
            >
              Mark no-show
            </Button>
          ) : null}
          {!requested &&
          !canRequestReschedule(appointment) &&
          !canRecordOutcome(appointment) &&
          appointment.status?.toLowerCase() !== 'confirmed' ? (
            <p className="text-[12.5px] text-ink-soft">
              No actions are available for this appointment.
            </p>
          ) : null}
        </div>
      </section>

      <RescheduleDialog
        appointment={rescheduleOpen ? appointment : null}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />
      <RecordSessionDialog
        appointment={sessionOpen ? appointment : null}
        open={sessionOpen}
        onOpenChange={setSessionOpen}
      />
      <NoShowDialog
        appointment={noShowOpen ? appointment : null}
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
      />
    </PageBody>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11.5px] text-ink-faint">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{value || 'Not provided'}</dd>
    </div>
  )
}
