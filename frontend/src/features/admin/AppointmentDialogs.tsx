import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { SelectField, TextField, TextareaField } from '@/components/form/FormFields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { showPromise } from '@/lib/toast'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { AppointmentFacts, RequestCallout } from './AppointmentFacts'
import {
  appointmentStatusLabel,
  formatDate,
  hasStarted,
  patientName,
  therapistName,
} from './format'
import {
  useApproveReschedule,
  useAssignTherapist,
  useCancelAppointment,
  useCompleteAppointment,
  useConfirmAppointment,
  useDeclineReschedule,
  useMarkNoShow,
  useRescheduleAppointment,
  useSendAppointmentNotification,
} from './mutations'
import { useAvailableTherapists } from './queries'
import {
  assignSchema,
  cancelSchema,
  notifySchema,
  rescheduleSchema,
  type AssignValues,
  type CancelValues,
  type NotifyValues,
  type RescheduleValues,
} from './schemas'
import type { AdminAppointment } from './types'

export type AppointmentDialogType =
  | 'assign'
  | 'confirm'
  | 'reschedule'
  | 'review'
  | 'requestReview'
  | 'cancel'
  | 'complete'
  | 'noShow'
  | 'notify'
  | 'view'

const cancelReasons = [
  { value: 'Patient requested', label: 'Patient requested' },
  { value: 'Therapist unavailable', label: 'Therapist unavailable' },
  { value: 'Clinic closure', label: 'Clinic closure' },
  { value: 'Other', label: 'Other' },
]

export function AppointmentDialogs({
  state,
  onClose,
  onAssigned,
}: {
  state: { type: AppointmentDialogType; appointment: AdminAppointment } | null
  onClose: () => void
  onAssigned?: (appointmentId: string) => void
}) {
  const [mode, setMode] = useState<AppointmentDialogType>(state?.type ?? 'view')
  const appointment = state?.appointment ?? null

  const confirm = useConfirmAppointment()
  const complete = useCompleteAppointment()
  const noShow = useMarkNoShow()
  const approve = useApproveReschedule()
  const decline = useDeclineReschedule()

  const busy =
    confirm.isPending ||
    complete.isPending ||
    noShow.isPending ||
    approve.isPending ||
    decline.isPending

  function run(request: Promise<unknown>, messages: { loading: string; success: string }) {
    showPromise(request, { ...messages, error: 'Unable to update this appointment.' })
    request.then(onClose, () => undefined)
  }

  if (!appointment) return null

  const target = resultingStatus(mode)
  const started = hasStarted(appointment)

  return (
    <Dialog open onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titleFor(mode)}</DialogTitle>
          <DialogDescription>
            {mode === 'cancel'
              ? 'The patient is notified and the slot is released.'
              : mode === 'notify'
                ? appointment.therapist
                  ? `${patientName(appointment)} and ${therapistName(appointment)} get this in-app and by email.`
                  : `${patientName(appointment)} gets this in-app and by email.`
                : `${therapistName(appointment)} · ${formatDate(appointment.createdAt)}`}
          </DialogDescription>
          {target ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <StatusBadge status={appointment.status} />
              <span aria-hidden="true" className="text-[11px] text-ink-faint">
                →
              </span>
              <StatusBadge status={target} />
            </div>
          ) : null}
        </DialogHeader>

        <AppointmentFacts appointment={appointment} />

        {mode === 'assign' ? (
          <AssignForm appointment={appointment} onDone={onClose} onAssigned={onAssigned} />
        ) : null}

        {mode === 'reschedule' ? (
          <RescheduleForm appointment={appointment} onDone={onClose} />
        ) : null}

        {mode === 'cancel' ? <CancelForm appointment={appointment} onDone={onClose} /> : null}

        {mode === 'notify' ? <NotifyForm appointment={appointment} onDone={onClose} /> : null}

        {mode === 'review' && appointment.rescheduleRequest ? (
          <>
            <div className="rounded-md border border-hairline p-3">
              <strong className="block text-[12.5px] text-ink">
                {appointment.rescheduleRequest.requestedBy} requested
              </strong>
              <span className="block text-[12px] text-ink-soft">
                {appointment.rescheduleRequest.proposedDate} at{' '}
                {appointment.rescheduleRequest.proposedTime}
              </span>
              <p className="mt-1 text-[12.5px] text-ink">
                {appointment.rescheduleRequest.reason || 'No reason provided.'}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    decline.mutateAsync({
                      id: appointment._id,
                      reason: 'The proposed time is not available.',
                    }),
                    {
                      loading: 'Declining request...',
                      success: 'Reschedule request declined.',
                    },
                  )
                }
              >
                Decline
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(approve.mutateAsync(appointment._id), {
                    loading: 'Approving request...',
                    success: 'Reschedule request approved.',
                  })
                }
              >
                Approve
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {mode === 'requestReview' ? (
          <>
            <RequestCallout appointment={appointment} />
            <p className="text-[12.5px] text-ink-soft">
              Review the request, then assign an available therapist from this panel. The service
              duration and fee shown here are the booking snapshot.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="button" onClick={() => setMode('assign')}>
                Assign therapist
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {mode === 'confirm' ? (
          <>
            <p className="text-[12.5px] text-ink-soft">
              This will reserve the therapist&apos;s time and notify the patient.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(confirm.mutateAsync(appointment._id), {
                    loading: 'Confirming appointment...',
                    success: 'Appointment confirmed.',
                  })
                }
              >
                {busy ? 'Confirming…' : 'Confirm appointment'}
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {mode === 'complete' || mode === 'noShow' ? (
          <>
            <p className="text-[12.5px] text-ink-soft">
              {mode === 'complete'
                ? 'No session record is required. The patient is notified once this is saved.'
                : 'This records that the patient did not attend the scheduled appointment.'}
            </p>
            {started ? null : (
              <p className="text-[12px] text-signal">Available once the session starts.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Keep appointment
              </Button>
              <Button
                type="button"
                variant={mode === 'noShow' ? 'destructive' : 'default'}
                disabled={busy || !started}
                title={started ? undefined : 'Available once the session starts'}
                onClick={() =>
                  mode === 'complete'
                    ? run(complete.mutateAsync(appointment._id), {
                        loading: 'Completing appointment...',
                        success: 'Appointment completed.',
                      })
                    : run(noShow.mutateAsync(appointment._id), {
                        loading: 'Marking no-show...',
                        success: 'Appointment marked no-show.',
                      })
                }
              >
                {mode === 'complete' ? 'Mark completed' : 'Mark no-show'}
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {mode === 'view' ? (
          <>
            <p className="text-[12.5px] text-ink-soft">
              Status: {appointmentStatusLabel(appointment.status)}. Created{' '}
              {formatDate(appointment.createdAt)}.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="button" onClick={() => setMode('notify')}>
                Send notification
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function titleFor(mode: AppointmentDialogType) {
  const titles: Record<AppointmentDialogType, string> = {
    assign: 'Assign therapist',
    confirm: 'Confirm appointment',
    reschedule: 'Reschedule appointment',
    review: 'Review reschedule request',
    requestReview: 'Review appointment request',
    cancel: 'Cancel appointment',
    complete: 'Mark completed',
    noShow: 'Mark no-show',
    notify: 'Send notification',
    view: 'Appointment details',
  }
  return titles[mode]
}

function resultingStatus(mode: AppointmentDialogType) {
  if (mode === 'cancel') return 'cancelled'
  if (mode === 'complete') return 'completed'
  if (mode === 'noShow') return 'no_show'
  return null
}

function AssignForm({
  appointment,
  onDone,
  onAssigned,
}: {
  appointment: AdminAppointment
  onDone: () => void
  onAssigned?: (appointmentId: string) => void
}) {
  const available = useAvailableTherapists(appointment._id)
  const assign = useAssignTherapist()
  const options = (available.data ?? []).map((therapist) => ({
    value: therapist._id,
    label: `${therapist.firstname || ''} ${therapist.lastname || ''}`.trim() || 'Therapist',
  }))
  const form = useForm<AssignValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: { therapistId: '', note: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    const request = assign.mutateAsync({ id: appointment._id, ...values, note: values.note.trim() })
    showPromise(request, {
      loading: 'Assigning therapist...',
      success: 'Therapist assigned.',
      error: 'Unable to assign a therapist.',
    })
    request.then(
      () => (onAssigned ? onAssigned(appointment._id) : onDone()),
      () => undefined,
    )
  })

  return (
    <Form {...form}>
      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
        <SelectField<AssignValues>
          control={form.control}
          name="therapistId"
          label="Available therapist"
          placeholder={options.length ? 'Select a therapist' : 'No therapist available'}
          options={options}
          description={
            options.length
              ? undefined
              : 'No available therapist for this date/time. Propose an alternative time before trying again.'
          }
        />
        <TextareaField<AssignValues>
          control={form.control}
          name="note"
          label="Note (optional)"
          rows={3}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={assign.isPending || !options.length}>
            {assign.isPending ? (
              <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
            ) : null}
            {assign.isPending ? 'Assigning…' : 'Assign therapist'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function RescheduleForm({
  appointment,
  onDone,
}: {
  appointment: AdminAppointment
  onDone: () => void
}) {
  const reschedule = useRescheduleAppointment()
  const form = useForm<RescheduleValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { newDate: '', newTime: '', reason: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    const request = reschedule.mutateAsync({
      id: appointment._id,
      newDate: values.newDate,
      newTime: values.newTime,
      reason: values.reason.trim(),
    })
    showPromise(request, {
      loading: 'Rescheduling appointment...',
      success: 'Appointment rescheduled.',
      error: 'Unable to reschedule this appointment.',
    })
    request.then(onDone, () => undefined)
  })

  return (
    <Form {...form}>
      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField<RescheduleValues>
            control={form.control}
            name="newDate"
            label="New date"
            type="date"
          />
          <TextField<RescheduleValues>
            control={form.control}
            name="newTime"
            label="New time"
            type="time"
          />
        </div>
        <TextareaField<RescheduleValues>
          control={form.control}
          name="reason"
          label="Reason (optional)"
          rows={3}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={reschedule.isPending}>
            {reschedule.isPending ? 'Saving…' : 'Save new time'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function CancelForm({
  appointment,
  onDone,
}: {
  appointment: AdminAppointment
  onDone: () => void
}) {
  const cancel = useCancelAppointment()
  const form = useForm<CancelValues>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: '', notes: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    const notes = values.notes.trim()
    const request = cancel.mutateAsync({
      id: appointment._id,
      reason: values.reason === 'Other' ? notes : `${values.reason}: ${notes}`,
    })
    showPromise(request, {
      loading: 'Cancelling appointment...',
      success: 'Appointment cancelled.',
      error: 'Unable to cancel this appointment.',
    })
    request.then(onDone, () => undefined)
  })

  return (
    <Form {...form}>
      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
        <SelectField<CancelValues>
          control={form.control}
          name="reason"
          label="Reason"
          placeholder="Choose a reason"
          options={cancelReasons}
        />
        <TextareaField<CancelValues>
          control={form.control}
          name="notes"
          label="Notes"
          rows={3}
          placeholder="Add context for the record"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Keep appointment
          </Button>
          <Button type="submit" variant="destructive" disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function NotifyForm({
  appointment,
  onDone,
}: {
  appointment: AdminAppointment
  onDone: () => void
}) {
  const send = useSendAppointmentNotification()
  const form = useForm<NotifyValues>({
    resolver: zodResolver(notifySchema),
    defaultValues: { message: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    const request = send.mutateAsync({ id: appointment._id, message: values.message.trim() })
    showPromise(request, {
      loading: 'Sending notification...',
      success: 'Notification sent.',
      error: 'Unable to send the notification.',
    })
    request.then(onDone, () => undefined)
  })

  return (
    <Form {...form}>
      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
        <TextareaField<NotifyValues>
          control={form.control}
          name="message"
          label="Message"
          rows={4}
          placeholder="Write the update the patient and therapist should see."
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? 'Sending…' : 'Send notification'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
