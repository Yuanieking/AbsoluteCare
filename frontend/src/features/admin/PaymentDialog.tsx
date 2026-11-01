import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { PaymentRecord, type PaymentHistoryItem } from '@/components/domain/PaymentRecord'
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
import { appointmentFee, formatMoney, patientName, personName, serviceName } from './format'
import { useRecordPayment, useUpdatePayment } from './mutations'
import { paymentSchema, type PaymentValues } from './schemas'
import type { AdminAppointment, PersonRef } from './types'

function toForm(appointment: AdminAppointment | null): PaymentValues {
  const payment = appointment?.payment
  return {
    status: payment?.status === 'unpaid' ? 'unpaid' : 'paid',
    amount: String(
      payment?.amount || appointment?.service?.fee || appointment?.serviceSnapshot?.fee || '',
    ),
    method: (payment?.method as PaymentValues['method']) || 'cash',
    referenceNumber: payment?.referenceNumber || '',
    notes: '',
  }
}

export function PaymentDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: AdminAppointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const record = useRecordPayment()
  const update = useUpdatePayment()
  const saving = record.isPending || update.isPending
  const alreadyPaid = appointment?.payment?.status === 'paid'
  const payment = appointment?.payment
  const recorder = (value?: PersonRef | string | null) =>
    typeof value === 'string' ? value : personName(value)
  const history: PaymentHistoryItem[] = (appointment?.paymentAudit ?? []).map((entry) => ({
    action: entry.action,
    by: recorder(entry.by),
    details: entry.details,
    at: entry.at,
  }))

  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: toForm(appointment),
  })
  const status = useWatch({ control: form.control, name: 'status' })

  useEffect(() => {
    if (open) form.reset(toForm(appointment))
  }, [appointment, form, open])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!appointment) return
    const amount = Number(values.amount)
    const method = values.method
    const referenceNumber = values.referenceNumber.trim()
    const notes = values.notes.trim()
    const payingNow = values.status === 'paid' && !alreadyPaid

    const request = payingNow
      ? record.mutateAsync({ id: appointment._id, amount, method, referenceNumber, notes })
      : update.mutateAsync({
          id: appointment._id,
          status: values.status,
          amount,
          method,
          referenceNumber,
          notes,
          reason: values.status === 'unpaid' ? notes : notes || 'Payment details updated.',
        })

    showPromise(request, {
      loading: 'Updating payment...',
      success: values.status === 'paid' ? 'Payment marked paid.' : 'Payment marked unpaid.',
      error: 'Unable to update payment.',
    })

    try {
      await request
      onOpenChange(false)
    } catch {}
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (saving ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update payment</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${patientName(appointment)} · ${serviceName(appointment)} · ${formatMoney(appointmentFee(appointment))} expected.`
              : 'Record or correct a clinic payment.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <PaymentRecord
            reference={payment?.referenceNumber}
            notes={payment?.notes}
            recordedBy={recorder(payment?.recordedBy)}
            recordedAt={payment?.recordedAt}
            history={history}
          />
          <form className="grid gap-3" onSubmit={onSubmit} noValidate>
            <SelectField<PaymentValues>
              control={form.control}
              name="status"
              label="Payment status"
              options={[
                { value: 'paid', label: 'Paid' },
                { value: 'unpaid', label: 'Unpaid' },
              ]}
            />

            {status === 'paid' ? (
              <>
                <TextField<PaymentValues>
                  control={form.control}
                  name="amount"
                  label="Amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                />
                <SelectField<PaymentValues>
                  control={form.control}
                  name="method"
                  label="Payment method"
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'gcash', label: 'GCash' },
                    { value: 'card', label: 'Card' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
                <TextField<PaymentValues>
                  control={form.control}
                  name="referenceNumber"
                  label="Reference number"
                  description="Required for GCash, card, or other."
                />
              </>
            ) : (
              <TextareaField<PaymentValues>
                control={form.control}
                name="notes"
                label="Reason"
                description="Required — this explains why the visit is no longer marked paid."
                rows={3}
              />
            )}

            {status === 'paid' ? (
              <TextareaField<PaymentValues>
                control={form.control}
                name="notes"
                label="Notes"
                rows={2}
              />
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
