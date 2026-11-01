import { formatDateTimeManila, formatTimeManila } from '@/lib/format/patient'
import type { PersonRef, SecretaryAppointment } from './types'

export function personName(person?: PersonRef | null) {
  if (!person) return ''
  const first = person.firstName ?? person.firstname
  const last = person.lastName ?? person.lastname
  return `${first || ''} ${last || ''}`.trim()
}

export function patientName(appointment?: SecretaryAppointment | null) {
  if (!appointment) return 'Patient'
  const dependent = appointment.dependent
  if (dependent) {
    const name = `${dependent.firstName ?? dependent.firstname ?? ''} ${
      dependent.lastName ?? dependent.lastname ?? ''
    }`.trim()
    if (name) return name
  }
  return personName(appointment.patient) || 'Patient'
}

export function patientCaption(appointment?: SecretaryAppointment | null) {
  if (appointment?.dependent) {
    return `Dependent of ${personName(appointment.patient) || 'a guardian'}`
  }
  return appointment?.patient?.email || appointment?.patient?.phone || 'No contact on file'
}

export function therapistLabel(appointment?: SecretaryAppointment | null) {
  return personName(appointment?.therapist) || 'Unassigned'
}

export function serviceName(appointment?: SecretaryAppointment | null) {
  return appointment?.service?.name || appointment?.serviceSnapshot?.name || 'Therapy session'
}

export function paymentAmount(appointment?: SecretaryAppointment | null) {
  return appointment?.payment?.amount || appointment?.service?.fee || 0
}

export function formatMoney(value?: number | null) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function paymentLabel(appointment?: SecretaryAppointment | null) {
  const status = appointment?.payment?.status === 'paid' ? 'Paid' : 'Unpaid'
  return `${status} · ${formatMoney(paymentAmount(appointment))}`
}

export function appointmentMoment(appointment: SecretaryAppointment) {
  if (appointment.scheduledStart) {
    const date = new Date(appointment.scheduledStart)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (appointment.requestedDate) {
    const date = new Date(`${appointment.requestedDate}T${appointment.requestedTime || '00:00'}`)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

export function scheduleLabel(appointment: SecretaryAppointment) {
  const moment = appointmentMoment(appointment)
  return moment ? formatDateTimeManila(moment) : 'Date to be confirmed'
}

export function scheduleTime(appointment: SecretaryAppointment) {
  return appointment.scheduledStart ? formatTimeManila(appointment.scheduledStart) : 'TBC'
}

export function manilaDayKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function todaySchedule(appointments: SecretaryAppointment[], now = new Date()) {
  const today = manilaDayKey(now)
  return appointments
    .filter((item) => {
      const moment = appointmentMoment(item)
      return moment ? manilaDayKey(moment) === today : false
    })
    .sort((a, b) => (appointmentMoment(a)?.getTime() ?? 0) - (appointmentMoment(b)?.getTime() ?? 0))
}

export function collectedSeries(appointments: SecretaryAppointment[], now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  })
  const months = Array.from({ length: 6 }, (_, index) =>
    formatter.format(new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)).slice(0, 7),
  )
  const totals = new Map(months.map((month) => [month, 0]))
  for (const appointment of appointments) {
    if (appointment.payment?.status !== 'paid') continue
    const stamp = appointment.payment.recordedAt || appointment.scheduledStart
    if (!stamp) continue
    const key = formatter.format(new Date(stamp)).slice(0, 7)
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + paymentAmount(appointment))
  }
  return months.map((month) => ({
    label: month,
    value: Math.round((totals.get(month) ?? 0) * 100) / 100,
  }))
}
