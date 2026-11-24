import { formatDateManila, formatDateTimeManila, formatTimeManila } from '@/lib/format/patient'
import { clinicDate } from '@/lib/format/clinic-time'

export function personName(person) {
  if (!person) return ''
  const first = person.firstName ?? person.firstname
  const last = person.lastName ?? person.lastname
  return `${first || ''} ${last || ''}`.trim()
}

export function patientName(appointment) {
  return personName(appointment?.patient) || 'Patient'
}

export function patientEmail(appointment) {
  return appointment?.patient?.email || ''
}

export function serviceName(appointment) {
  return appointment?.service?.name || appointment?.serviceSnapshot?.name || 'Therapy session'
}

export function therapistFullName(profile) {
  if (!profile) return ''
  return `${profile.firstname || profile.firstName || ''} ${
    profile.lastname || profile.lastName || ''
  }`.trim()
}

export function specializationList(profile) {
  const value = profile?.specialization
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

export function appointmentMoment(appointment) {
  const value = appointment.scheduledStart || appointment.requestedDate
  if (!value) return null
  const time = appointment.scheduledStart ? undefined : appointment.requestedTime || '00:00'
  const date = clinicDate(time ? `${value}T${time}` : value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function appointmentLabel(appointment) {
  if (!appointment) return 'Schedule to be confirmed'
  if (appointment.scheduledStart) return formatDateTimeManila(appointment.scheduledStart)
  if (appointment.requestedDate) {
    return `${formatDateManila(appointment.requestedDate)} · ${appointment.requestedTime || 'Time to confirm'} (requested)`
  }
  return 'Schedule to be confirmed'
}

export function appointmentTimeLabel(appointment) {
  return appointment.scheduledStart
    ? formatTimeManila(appointment.scheduledStart)
    : appointment.requestedTime || 'TBC'
}

export function isPastAppointment(appointment, now = Date.now()) {
  const moment = appointmentMoment(appointment)
  return moment ? moment.getTime() < now : false
}

export function isFutureOrOpen(appointment, now = Date.now()) {
  const moment = appointmentMoment(appointment)
  return moment ? moment.getTime() >= now : true
}

export function canRequestReschedule(appointment, now = Date.now()) {
  const status = appointment.status?.toLowerCase()
  return (status === 'pending' || status === 'confirmed') && isFutureOrOpen(appointment, now)
}

export function canRecordOutcome(appointment, now = Date.now()) {
  return appointment.status?.toLowerCase() === 'confirmed' && isPastAppointment(appointment, now)
}

/** Set while an admin still has to answer the therapist's reschedule request. */
export function openRescheduleRequest(appointment) {
  const request = appointment?.rescheduleRequest
  if (request?.status !== 'requested' || !request.proposedDate) return null
  return `${formatDateManila(request.proposedDate)} · ${request.proposedTime || 'Time to confirm'}`
}

export function matchesTab(appointment, tab, now = Date.now()) {
  const status = appointment.status?.toLowerCase() || ''
  const past = isPastAppointment(appointment, now)
  if (tab === 'previous') {
    return ['completed', 'cancelled', 'no_show', 'no-show'].includes(status) || past
  }
  return status !== 'cancelled' && (status === 'confirmed' || status === 'pending') && !past
}

export function tabCounts(appointments, now = Date.now()) {
  return {
    total: appointments.length,
    upcoming: appointments.filter((item) => matchesTab(item, 'upcoming', now)).length,
    previous: appointments.filter((item) => matchesTab(item, 'previous', now)).length,
  }
}

export function manilaDayKey(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function todaysSchedule(appointments, now = new Date()) {
  const today = manilaDayKey(now)
  return appointments
    .filter((item) => {
      const moment = appointmentMoment(item)
      return moment ? manilaDayKey(moment) === today : false
    })
    .sort((a, b) => (appointmentMoment(a)?.getTime() ?? 0) - (appointmentMoment(b)?.getTime() ?? 0))
}

export function nextVisit(todays, now = new Date()) {
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

export function monthlySeries(items, dateOf, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  })
  const months = Array.from({ length: 6 }, (_, index) =>
    new Date(
      Date.UTC(
        Number(manilaDayKey(now).slice(0, 4)),
        Number(manilaDayKey(now).slice(5, 7)) - 1 - (5 - index),
        1,
      ),
    )
      .toISOString()
      .slice(0, 7),
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

export function sessionSeries(sessions, now = new Date()) {
  return monthlySeries(sessions, (session) => session.sessionDate, now)
}

export function completionRate(appointments) {
  if (!appointments.length) return 0
  const completed = appointments.filter((item) => item.status?.toLowerCase() === 'completed').length
  return Math.round((completed / appointments.length) * 100)
}
