import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { TextField, TextareaField } from '@/components/form/FormFields'
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
import { todayInManila } from '@/lib/format/patient'
import { showPromise } from '@/lib/toast'
import { useRequestReschedule } from './mutations'
import { rescheduleSchema, type RescheduleValues } from './schemas'

export function RescheduleDialog({
  appointmentId,
  open,
  onOpenChange,
}: {
  appointmentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useRequestReschedule()
  const form = useForm<RescheduleValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { proposedDate: '', proposedTime: '', reason: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (!appointmentId) return
    const request = mutation.mutateAsync({ id: appointmentId, ...values })
    showPromise(request, {
      loading: 'Submitting reschedule request...',
      success: 'Reschedule request sent.',
      error: "Couldn't submit the reschedule request.",
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
          <DialogTitle>Request a reschedule</DialogTitle>
          <DialogDescription>
            Your current appointment stays in place until the care team reviews your request.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-3" onSubmit={onSubmit} noValidate>
            <TextField<RescheduleValues>
              control={form.control}
              name="proposedDate"
              label="Preferred date"
              type="date"
              min={todayInManila()}
            />
            <TextField<RescheduleValues>
              control={form.control}
              name="proposedTime"
              label="Preferred time"
              type="time"
            />
            <TextareaField<RescheduleValues>
              control={form.control}
              name="reason"
              label="Reason (optional)"
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
