import {
  appointmentFee,
  appointmentStart,
  formatDateTime,
  formatMoney,
  patientName,
  serviceName,
  therapistName,
} from './format'
import type { AdminAppointment } from './types'

export function AppointmentFacts({ appointment }: { appointment: AdminAppointment }) {
  const service = appointment.serviceSnapshot || appointment.service
  const rows = [
    { label: 'Patient', value: patientName(appointment) },
    {
      label: 'Service',
      value: `${serviceName(appointment)}${service?.duration ? ` · ${service.duration} min` : ''} · ${formatMoney(appointmentFee(appointment))}`,
    },
    { label: 'Date and time', value: formatDateTime(appointmentStart(appointment)) },
    { label: 'Therapist', value: therapistName(appointment) },
  ]
  return (
    <dl className="grid gap-2 rounded-md bg-sunk p-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-[11.5px] text-ink-faint">{row.label}</dt>
          <dd className="mt-0.5 text-[12.5px] text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function RequestCallout({ appointment }: { appointment: AdminAppointment }) {
  return (
    <div className="rounded-md border border-hairline p-3">
      <strong className="block text-[12.5px] text-ink">Patient contact</strong>
      <span className="block text-[12px] text-ink-soft">
        {appointment.patient?.email || 'Email not added'} ·{' '}
        {appointment.patient?.phone || 'Phone not added'}
      </span>
      <p className="mt-1 text-[12.5px] text-ink">
        {appointment.notes || 'No notes or special requirements were added.'}
      </p>
    </div>
  )
}
