import { clinicDate, clinicDay } from './clinic-time'

function toDate(value) {
  if (!value) return null
  const date = clinicDate(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatAppointmentDate(value) {
  if (!value) return 'Date to be confirmed'
  const date = toDate(value)
  if (!date) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(date)
}

export function todayInManila() {
  return clinicDay()
}

export function formatAppointmentTime(start, end, fallback = '') {
  if (!start) return fallback || 'Time to be confirmed'
  const formatter = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })
  const first = formatter.format(clinicDate(start))
  return end ? `${first} – ${formatter.format(clinicDate(end))}` : first
}

export function appointmentDate(appointment) {
  return appointment.scheduledStart
    ? formatAppointmentDate(appointment.scheduledStart)
    : appointment.requestedDate || 'Date to be confirmed'
}

export function isPastAppointment(appointment, now = Date.now()) {
  const start = appointment.scheduledStart
    ? new Date(appointment.scheduledStart)
    : appointment.requestedDate
      ? new Date(`${appointment.requestedDate}T${appointment.requestedTime || '00:00'}:00+08:00`)
      : null
  return start && !Number.isNaN(start.getTime()) ? start.getTime() <= now : false
}

export function appointmentTime(appointment) {
  return appointment.scheduledStart
    ? formatAppointmentTime(appointment.scheduledStart, appointment.scheduledEnd)
    : appointment.requestedTime || 'Time to be confirmed'
}

export function therapistName(therapist) {
  if (!therapist) return 'To be assigned'
  return (
    `${therapist.firstname || therapist.firstName || ''} ${
      therapist.lastname || therapist.lastName || ''
    }`.trim() || 'Assigned therapist'
  )
}

export function formatDateTimeManila(value) {
  if (!value) return ''
  const date = toDate(value)
  if (!date) return String(value)

  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).formatToParts(date)

  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${get('weekday')}, ${get('month')} ${get('day')}, ${get('year')} · ${get('hour')}:${get('minute')} ${get('dayPeriod')}`
}

export function formatRequestedDateTimeManila(date, time) {
  if (!date) return ''
  return formatDateTimeManila(`${date}T${time || '00:00'}`)
}

export function formatDateManila(value) {
  if (!value) return ''
  const date = toDate(value)
  if (!date) return String(value)

  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).formatToParts(date)

  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${get('weekday')}, ${get('month')} ${get('day')}`
}

export function formatTimeManila(value) {
  if (!value) return ''
  const date = toDate(value)
  if (!date) return String(value)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(date)
}

export function relativeTime(value) {
  const date = clinicDate(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const absolute = Math.abs(seconds)
  if (absolute < 60) return formatter.format(seconds, 'second')
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (absolute < 86400) return formatter.format(Math.round(seconds / 3600), 'hour')
  return formatter.format(Math.round(seconds / 86400), 'day')
}
