import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { appointmentTime, therapistName } from '@/lib/format/patient'
import type { Appointment } from '@/features/patient/types'

function manilaDateParts(value: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Manila',
  }).formatToParts(new Date(value))

  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return { weekday: get('weekday'), day: get('day'), month: get('month') }
}

function Tear() {
  return (
    <div className="relative mx-[22px] h-px" aria-hidden="true">
      <span className="absolute inset-0 border-t border-dashed border-hairline" />
      <span className="absolute -top-2 -left-[30px] size-4 rounded-full border border-hairline bg-canvas" />
      <span className="absolute -top-2 -right-[30px] size-4 rounded-full border border-hairline bg-canvas" />
    </div>
  )
}

export function AppointmentDocket({ appointment }: { appointment?: Appointment | null }) {
  if (!appointment) {
    return (
      <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-hairline bg-panel">
        <div className="flex flex-1 flex-col justify-center px-[22px] pt-6 pb-1">
          <p className="mb-3 text-[11.5px] font-medium text-ink-faint">Next visit</p>
          <h2 className="font-display text-[22px] leading-tight font-semibold tracking-[-0.025em] text-ink">
            Nothing booked yet
          </h2>
          <p className="mt-2.5 max-w-[36ch] text-[13px] leading-relaxed text-ink-soft">
            Pick a service and a time that works for you. Your next visit will appear here.
          </p>
        </div>
        <Tear />
        <div className="flex flex-wrap items-center gap-2 px-[22px] pt-4 pb-[18px]">
          <Button asChild size="sm">
            <Link to="/dashboard/book">Book a visit</Link>
          </Button>
        </div>
      </article>
    )
  }

  const date = appointment.scheduledStart
    ? manilaDateParts(appointment.scheduledStart)
    : { weekday: 'Requested', day: '—', month: appointment.requestedDate || 'date' }

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-hairline bg-panel">
      <div className="flex flex-1 flex-col justify-center px-[22px] py-6">
        <p className="mb-3 text-[11.5px] font-medium text-ink-faint">Next visit</p>
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-[16px] font-medium tracking-[-0.02em] text-ink-soft">
            {date.weekday}
          </span>
          <span className="font-display text-[clamp(30px,3vw,40px)] leading-none font-semibold tracking-[-0.045em] text-ink tabular-nums">
            {date.day}
          </span>
          <span className="text-[16px] font-medium tracking-[-0.02em] text-ink-soft">
            {date.month}
          </span>
        </p>
        <p className="mt-2 text-[13px] font-medium text-ink tabular-nums">
          {appointmentTime(appointment)}
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-[18px] gap-y-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[11px] text-ink-faint">Service</dt>
            <dd className="text-[12.5px] font-medium text-ink [overflow-wrap:anywhere]">
              {appointment.service?.name || 'Therapy session'}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[11px] text-ink-faint">Therapist</dt>
            <dd className="text-[12.5px] font-medium text-ink [overflow-wrap:anywhere]">
              {therapistName(appointment.therapist)}
            </dd>
          </div>
        </dl>
      </div>
      <Tear />
      <div className="flex flex-wrap items-center gap-2 px-[22px] pt-4 pb-[18px]">
        <Button asChild size="sm">
          <Link to="/dashboard/appointments">View visit</Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <Link to="/dashboard/appointments">Reschedule</Link>
        </Button>
      </div>
    </article>
  )
}
