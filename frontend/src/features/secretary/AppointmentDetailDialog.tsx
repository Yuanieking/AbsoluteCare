import { RefreshCw } from 'lucide-react'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatMoney,
  patientCaption,
  patientName,
  paymentAmount,
  scheduleLabel,
  serviceName,
  therapistLabel,
} from './format'
import { useSecretaryAppointment } from './queries'
import type { SecretaryAppointment } from './types'

export function AppointmentDetailDialog({
  appointmentId,
  onOpenChange,
  onRecordPayment,
}: {
  appointmentId: string | null
  onOpenChange: (open: boolean) => void
  onRecordPayment: (appointment: SecretaryAppointment) => void
}) {
  const query = useSecretaryAppointment(appointmentId ?? undefined)
  const appointment = query.data

  return (
    <Dialog open={Boolean(appointmentId)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Appointment details</DialogTitle>
          <DialogDescription>Read-only visit information for the front desk.</DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="grid gap-2" role="status" aria-label="Loading appointment details">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-10 rounded-md" />
            ))}
          </div>
        ) : query.error ? (
          <EmptyState
            icon={<RefreshCw size={20} />}
            title="We couldn’t load this appointment"
            message={query.error.message}
            action={
              <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          />
        ) : appointment ? (
          <>
            <dl className="grid gap-2 rounded-md bg-sunk p-3.5 text-[12.5px]">
              <Row
                label="Patient"
                value={patientName(appointment)}
                caption={patientCaption(appointment)}
              />
              <Row
                label="Service"
                value={serviceName(appointment)}
                caption={
                  appointment.service?.duration
                    ? `${appointment.service.duration} minutes`
                    : undefined
                }
              />
              <Row label="Therapist" value={therapistLabel(appointment)} />
              <Row label="Date and time" value={scheduleLabel(appointment)} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-ink-soft">Status</dt>
                <dd>
                  <StatusBadge status={appointment.status} />
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-ink-soft">Payment</dt>
                <dd>
                  <StatusBadge status={appointment.payment?.status || 'unpaid'} />
                  <span className="ml-2 text-[12px] text-ink-soft tabular-nums">
                    {formatMoney(paymentAmount(appointment))}
                  </span>
                </dd>
              </div>
            </dl>

            {appointment.cancelReason ? (
              <p className="text-[12px] text-ink-soft">
                Cancellation reason: {appointment.cancelReason}
              </p>
            ) : null}
            <p className="text-[12px] text-ink-soft">
              Scheduling changes are managed by the clinic administrator.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {appointment.payment?.status !== 'paid' ? (
                <Button type="button" onClick={() => onRecordPayment(appointment)}>
                  Record payment
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-medium text-ink">
        {value}
        {caption ? (
          <span className="block text-[11.5px] font-normal text-ink-faint">{caption}</span>
        ) : null}
      </dd>
    </div>
  )
}
