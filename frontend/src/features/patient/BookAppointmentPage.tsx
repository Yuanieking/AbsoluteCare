import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarPlus, Check, Clock3, UserRound } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SelectField, TextField, TextareaField } from '@/components/form/FormFields'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { todayInManila } from '@/lib/format/patient'
import { showPromise } from '@/lib/toast'
import { useBookAppointment } from './mutations'
import { useDependents, useServices } from './queries'
import { bookingSchema, type BookingValues } from './schemas'

export default function BookAppointmentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const services = useServices()
  const dependents = useDependents()
  const bookMutation = useBookAppointment()

  const form = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      service: '',
      requestedDate: '',
      requestedTime: '',
      dependent: searchParams.get('dependent') || '',
      notes: '',
    },
  })

  const selectedService = useWatch({ control: form.control, name: 'service' })
  const serviceList = services.data ?? []
  const dependentList = dependents.data ?? []

  const onSubmit = form.handleSubmit(async (values) => {
    const request = bookMutation.mutateAsync({
      ...values,
      dependent: values.dependent || null,
    })
    showPromise(request, {
      loading: 'Submitting your request...',
      success: 'Appointment request sent.',
      error: "Couldn't submit your request.",
    })
    try {
      await request
      navigate('/dashboard/appointments')
    } catch {}
  })

  if (services.isLoading || dependents.isLoading) {
    return (
      <PageBody aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-5 h-32 rounded-lg" />
        <Skeleton className="mt-3 h-14 rounded-lg" />
      </PageBody>
    )
  }

  const loadError = services.error?.message || dependents.error?.message

  return (
    <PageBody>
      <PageHeader
        eyebrow="Plan your next visit"
        title="Book an appointment"
        description="Choose a service and a preferred window. The clinic confirms the exact therapist and time."
      />

      {loadError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-[12.5px] text-destructive"
        >
          {loadError}
        </p>
      ) : null}

      <Form {...form}>
        <form className="mt-5 grid max-w-[760px] gap-4" onSubmit={onSubmit} noValidate>
          <fieldset>
            <legend className="mb-2 text-[12.5px] font-medium text-ink">
              Choose a therapy service
            </legend>
            <div className="grid gap-2">
              {serviceList.map((service) => (
                <label
                  key={service._id}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                    selectedService === service._id
                      ? 'border-primary bg-primary-soft/40'
                      : 'border-hairline bg-card hover:border-ink-faint/60',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    value={service._id}
                    className="mt-0.5 size-4 accent-[var(--ac-primary)]"
                    {...form.register('service')}
                  />
                  <span className="min-w-0">
                    <strong className="block text-[13.5px] text-ink">{service.name}</strong>
                    <span className="mt-0.5 block text-[12.5px] text-ink-soft">
                      {service.description}
                    </span>
                    <small className="mt-1 block text-[11.5px] text-ink-faint">
                      {service.duration} minutes
                      {service.fee && service.fee > 0
                        ? ` · ₱${service.fee}`
                        : ' · Clinic fee confirmed after review'}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            {form.formState.errors.service ? (
              <p role="alert" className="mt-1 text-[11.5px] text-destructive">
                {form.formState.errors.service.message}
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField<BookingValues>
              control={form.control}
              name="requestedDate"
              label="Preferred date"
              type="date"
              min={todayInManila()}
            />
            <TextField<BookingValues>
              control={form.control}
              name="requestedTime"
              label="Preferred time"
              type="time"
            />
          </div>

          {dependentList.length > 0 ? (
            <SelectField<BookingValues>
              control={form.control}
              name="dependent"
              label="For whom"
              options={[
                { value: '', label: 'Myself' },
                ...dependentList.map((dependent) => ({
                  value: dependent._id,
                  label: `${dependent.firstName} ${dependent.lastName}`,
                })),
              ]}
            />
          ) : null}

          <TextareaField<BookingValues>
            control={form.control}
            name="notes"
            label="Notes for the care team"
            rows={4}
            maxLength={1000}
            placeholder="Anything we should know before your visit?"
          />

          {form.formState.errors.root ? (
            <p role="alert" className="text-[12.5px] text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <Button type="submit" disabled={bookMutation.isPending} className="justify-self-start">
            <CalendarPlus size={16} aria-hidden="true" />
            {bookMutation.isPending ? 'Sending request…' : 'Request appointment'}
          </Button>
        </form>
      </Form>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-hairline-in pt-4 text-[12px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={15} aria-hidden="true" /> Choose a preferred time
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserRound size={15} aria-hidden="true" /> We’ll assign your therapist
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check size={15} aria-hidden="true" /> Review before confirmation
        </span>
      </div>
    </PageBody>
  )
}
