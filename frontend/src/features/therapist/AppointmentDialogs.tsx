import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { TextField, TextareaField } from '@/components/form/FormFields'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/domain/StatusBadge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { todayInManila } from '@/lib/format/patient'
import { showPromise } from '@/lib/toast'
import { appointmentLabel, canRecordOutcome, patientName } from './format'
import { useCreateSession, useMarkNoShow, useRequestReschedule } from './mutations'
import {
  rescheduleSchema,
  sessionSchema,
  type RescheduleValues,
  type SessionValues,
} from './schemas'
import type { Appointment } from './types'

function blankSession(): SessionValues {
  return {
    sessionDate: todayInManila(),
    durationMinutes: '60',
    patientVisibleNotes: '',
    clinicalNotes: '',
  }
}

export function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useRequestReschedule()
  const form = useForm<RescheduleValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { proposedDate: '', proposedTime: '', reason: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (!appointment) return
    const request = mutation.mutateAsync({ id: appointment._id, ...values })
    showPromise(request, {
      loading: 'Sending reschedule request...',
      success: 'Reschedule request sent to the patient.',
      error: "Couldn't send the reschedule request.",
    })
    try {
      await request
      form.reset()
      onOpenChange(false)
    } catch {}
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request an appointment reschedule</DialogTitle>
          <DialogDescription>
            Propose a new time for {patientName(appointment)}. The current visit stays booked until
            the patient accepts.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-3" onSubmit={onSubmit} noValidate>
            <TextField<RescheduleValues>
              control={form.control}
              name="proposedDate"
              label="Proposed date"
              type="date"
              min={todayInManila()}
            />
            <TextField<RescheduleValues>
              control={form.control}
              name="proposedTime"
              label="Proposed time"
              type="time"
            />
            <TextareaField<RescheduleValues>
              control={form.control}
              name="reason"
              label="Reason for the patient"
              rows={3}
              maxLength={500}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Sending…' : 'Send request'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function RecordSessionDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useCreateSession()
  const form = useForm<SessionValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: blankSession(),
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (!appointment) return
    const request = mutation.mutateAsync({
      id: appointment._id,
      ...values,
      durationMinutes: Number(values.durationMinutes),
    })
    showPromise(request, {
      loading: 'Recording therapy session...',
      success: 'Therapy session recorded.',
      error: "Couldn't record the therapy session.",
    })
    try {
      await request
      form.reset(blankSession())
      onOpenChange(false)
    } catch {}
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset(blankSession())
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record therapy session</DialogTitle>
          <DialogDescription>
            Document the visit with {patientName(appointment)}. Recording completes the appointment.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-3" onSubmit={onSubmit} noValidate>
            <TextField<SessionValues>
              control={form.control}
              name="sessionDate"
              label="Session date"
              type="date"
              max={todayInManila()}
            />
            <TextField<SessionValues>
              control={form.control}
              name="durationMinutes"
              label="Duration (minutes)"
              type="number"
              min={1}
              max={240}
            />
            <TextareaField<SessionValues>
              control={form.control}
              name="clinicalNotes"
              label="Clinical notes"
              description="Progress, exercises completed, clinical evaluation. Staff only."
              rows={4}
              maxLength={4000}
            />
            <TextareaField<SessionValues>
              control={form.control}
              name="patientVisibleNotes"
              label="Notes for the patient"
              description="Shown in the patient's portal with this session. Leave blank to share nothing."
              rows={3}
              maxLength={4000}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save session record'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function NoShowDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useMarkNoShow()
  const started = appointment ? canRecordOutcome(appointment) : false

  function confirm() {
    if (!appointment) return
    const request = mutation.mutateAsync(appointment._id)
    showPromise(request, {
      loading: 'Marking appointment as no-show...',
      success: 'Appointment marked as no-show.',
      error: "Couldn't mark the appointment as no-show.",
    })
    request.then(
      () => onOpenChange(false),
      () => undefined,
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark no-show</AlertDialogTitle>
          <AlertDialogDescription>
            {patientName(appointment)} did not attend the visit on {appointmentLabel(appointment)}.
            This closes the appointment for good.
          </AlertDialogDescription>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <StatusBadge status={appointment?.status} />
            <span aria-hidden="true" className="text-[11px] text-ink-faint">
              →
            </span>
            <StatusBadge status="no_show" />
          </div>
          {started ? null : (
            <p className="text-[12px] text-signal">Available once the session starts.</p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Keep appointment</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending || !started}
            title={started ? undefined : 'Available once the session starts'}
            onClick={(event) => {
              event.preventDefault()
              confirm()
            }}
          >
            {mutation.isPending ? 'Marking…' : 'Mark no-show'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
