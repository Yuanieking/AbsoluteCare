import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { PaymentRecord } from '@/components/domain/PaymentRecord'
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
import { formatMoney, patientName, paymentAmount } from './format'
import { useRecordPayment, useUpdatePayment } from './mutations'
import { paymentSchema, type PaymentValues } from './schemas'
import type { SecretaryAppointment } from './types'

export type PaymentMode = 'record' | 'edit'

function toForm(appointment: SecretaryAppointment | null, mode: PaymentMode): PaymentValues {
  const payment = appointment?.payment
  return {
    status: payment?.status === 'unpaid' ? 'unpaid' : 'paid',
    amount: String(payment?.amount || appointment?.service?.fee || ''),
    method: payment?.method || 'cash',
    referenceNumber: payment?.referenceNumber || '',
    notes: mode === 'edit' ? payment?.notes || '' : '',
  }
}

export function PaymentDialog({
  appointment,
  mode,
  open,
  onOpenChange,
  onSaved,
}: {
  appointment: SecretaryAppointment | null
  mode: PaymentMode
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (updated: SecretaryAppointment) => void
}) {
  const record = useRecordPayment()
  const update = useUpdatePayment()
  const editing = mode === 'edit'
  const saving = record.isPending || update.isPending

  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: toForm(appointment, mode),
  })
  const status = useWatch({ control: form.control, name: 'status' })

  useEffect(() => {
    if (open) form.reset(toForm(appointment, mode))
  }, [appointment, form, mode, open])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!appointment) return
    const amount = Number(values.amount)
    const method = values.method
    const referenceNumber = values.referenceNumber.trim()
    const notes = values.notes.trim()
    const request = editing
      ? update.mutateAsync({
          id: appointment._id,
          status: values.status,
          amount,
          method,
          referenceNumber,
          notes,
          reason: notes || (values.status === 'unpaid' ? undefined : 'Payment details updated.'),
        })
      : record.mutateAsync({ id: appointment._id, amount, method, referenceNumber, notes })

    showPromise(request, {
      loading: editing ? 'Updating payment...' : 'Recording payment...',
      success: editing ? 'Payment status updated.' : 'Payment recorded.',
      error: editing ? 'Unable to save payment.' : 'Unable to record payment.',
    })

    try {
      const updated = await request
      onOpenChange(false)
      onSaved?.(updated)
    } catch {}
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset(toForm(appointment, mode))
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit payment' : 'Record payment'}</DialogTitle>
          <DialogDescription>
            {patientName(appointment)} · {formatMoney(paymentAmount(appointment))} expected.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <PaymentRecord
            reference={appointment?.payment?.referenceNumber}
            notes={appointment?.payment?.notes}
            recordedBy={appointment?.payment?.recordedBy}
            recordedAt={appointment?.payment?.recordedAt}
            history={appointment?.payment?.history}
          />
          <form className="grid gap-3" onSubmit={onSubmit} noValidate>
            {editing ? (
              <SelectField<PaymentValues>
                control={form.control}
                name="status"
                label="Payment status"
                options={[
                  { value: 'paid', label: 'Paid' },
                  { value: 'unpaid', label: 'Unpaid' },
                ]}
              />
            ) : null}

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
            ) : null}

            <TextareaField<PaymentValues>
              control={form.control}
              name="notes"
              label={editing ? 'Reason or notes' : 'Notes'}
              description={
                status === 'unpaid'
                  ? 'Required — this explains why the visit is no longer marked paid.'
                  : editing
                    ? 'Optional note for the payment record.'
                    : 'Optional note for the payment record.'
              }
              rows={3}
              maxLength={500}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save payment' : 'Record payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
