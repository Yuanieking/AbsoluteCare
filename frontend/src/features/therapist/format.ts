import { formatDateManila, formatDateTimeManila, formatTimeManila } from '@/lib/format/patient'
import type {
  Appointment,
  DependentRef,
  PatientRef,
  SessionRecord,
  TherapistProfile,
} from './types'

export type AppointmentTab = 'upcoming' | 'previous'

export function personName(person?: PatientRef | DependentRef | null) {
  if (!person) return ''
  const first = person.firstName ?? person.firstname
  const last = person.lastName ?? person.lastname
  return `${first || ''} ${last || ''}`.trim()
}

export function patientName(appointment?: Appointment | null) {
  return personName(appointment?.patient) || 'Patient'
}

export function patientEmail(appointment?: Appointment | null) {
  return appointment?.patient?.email || ''
}

export function serviceName(appointment?: Appointment | null) {
  return appointment?.service?.name || appointment?.serviceSnapshot?.name || 'Therapy session'
}

export function therapistFullName(profile?: TherapistProfile | null) {
  if (!profile) return ''
  return `${profile.firstname || profile.firstName || ''} ${
    profile.lastname || profile.lastName || ''
  }`.trim()
}

export function specializationList(profile?: TherapistProfile | null) {
  const value = profile?.specialization
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

export function appointmentMoment(appointment: Appointment) {
  const value = appointment.scheduledStart || appointment.requestedDate
  if (!value) return null
  const time = appointment.scheduledStart ? undefined : appointment.requestedTime || '00:00'
  const date = new Date(time ? `${value}T${time}` : value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function appointmentLabel(appointment?: Appointment | null) {
  if (!appointment) return 'Schedule to be confirmed'
  if (appointment.scheduledStart) return formatDateTimeManila(appointment.scheduledStart)
  if (appointment.requestedDate) {
    return `${formatDateManila(appointment.requestedDate)} · ${appointment.requestedTime || 'Time to confirm'} (requested)`
  }
  return 'Schedule to be confirmed'
}

export function appointmentTimeLabel(appointment: Appointment) {
  return appointment.scheduledStart
    ? formatTimeManila(appointment.scheduledStart)
    : appointment.requestedTime || 'TBC'
}

export function isPastAppointment(appointment: Appointment, now = Date.now()) {
  const moment = appointmentMoment(appointment)
  return moment ? moment.getTime() < now : false
}

export function isFutureOrOpen(appointment: Appointment, now = Date.now()) {
  const moment = appointmentMoment(appointment)
  return moment ? moment.getTime() >= now : true
}

export function canRequestReschedule(appointment: Appointment, now = Date.now()) {
  const status = appointment.status?.toLowerCase()
  return (status === 'pending' || status === 'confirmed') && isFutureOrOpen(appointment, now)
}

export function canRecordOutcome(appointment: Appointment, now = Date.now()) {
  return appointment.status?.toLowerCase() === 'confirmed' && isPastAppointment(appointment, now)
}

/** Set while an admin still has to answer the therapist's reschedule request. */
export function openRescheduleRequest(appointment?: Appointment | null) {
  const request = appointment?.rescheduleRequest
  if (request?.status !== 'requested' || !request.proposedDate) return null
  return `${formatDateManila(request.proposedDate)} · ${request.proposedTime || 'Time to confirm'}`
}

export function matchesTab(appointment: Appointment, tab: AppointmentTab, now = Date.now()) {
  const status = appointment.status?.toLowerCase() || ''
  const past = isPastAppointment(appointment, now)
  if (tab === 'previous') {
    return ['completed', 'cancelled', 'no_show', 'no-show'].includes(status) || past
  }
  return status !== 'cancelled' && (status === 'confirmed' || status === 'pending') && !past
}

export function tabCounts(appointments: Appointment[], now = Date.now()) {
  return {
    total: appointments.length,
    upcoming: appointments.filter((item) => matchesTab(item, 'upcoming', now)).length,
    previous: appointments.filter((item) => matchesTab(item, 'previous', now)).length,
  }
}

export function manilaDayKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function todaysSchedule(appointments: Appointment[], now = new Date()) {
  const today = manilaDayKey(now)
  return appointments
    .filter((item) => {
      const moment = appointmentMoment(item)
      return moment ? manilaDayKey(moment) === today : false
    })
    .sort((a, b) => (appointmentMoment(a)?.getTime() ?? 0) - (appointmentMoment(b)?.getTime() ?? 0))
}

export function nextVisit(todays: Appointment[], now = new Date()) {
  return (
    todays.find(
      (item) =>
        item.status?.toLowerCase() === 'confirmed' &&
        item.scheduledStart &&
        new Date(item.scheduledStart) >= now,
    ) ||
    todays.find((item) => ['confirmed', 'pending'].includes(item.status?.toLowerCase())) ||
    null
  )
}

export function monthlySeries<T>(
  items: T[],
  dateOf: (item: T) => string | undefined,
  now = new Date(),
) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  })
  const months = Array.from({ length: 6 }, (_, index) =>
    formatter.format(new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)).slice(0, 7),
  )
  const counts = new Map(months.map((month) => [month, 0]))
  for (const item of items) {
    const value = dateOf(item)
    if (!value) continue
    const key = formatter.format(new Date(value)).slice(0, 7)
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return months.map((month) => ({ label: month, value: counts.get(month) ?? 0 }))
}

export function sessionSeries(sessions: SessionRecord[], now = new Date()) {
  return monthlySeries(sessions, (session) => session.sessionDate, now)
}

export function completionRate(appointments: Appointment[]) {
  if (!appointments.length) return 0
  const completed = appointments.filter((item) => item.status?.toLowerCase() === 'completed').length
  return Math.round((completed / appointments.length) * 100)
}
