type DateValue = string | Date | null | undefined

type AppointmentLike = {
  scheduledStart?: string | null
  scheduledEnd?: string | null
  requestedDate?: string | null
  requestedTime?: string | null
}

type TherapistLike = {
  firstname?: string | null
  firstName?: string | null
  lastname?: string | null
  lastName?: string | null
} | null

function toDate(value: DateValue): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatAppointmentDate(value: DateValue): string {
  if (!value) return 'Date to be confirmed'
  const date = toDate(value)
  if (!date) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(date)
}

export function todayInManila(): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Manila',
    year: 'numeric',
  }).format(new Date())
}

export function formatAppointmentTime(start: DateValue, end?: DateValue, fallback = ''): string {
  if (!start) return fallback || 'Time to be confirmed'
  const formatter = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })
  const first = formatter.format(new Date(start))
  return end ? `${first} – ${formatter.format(new Date(end))}` : first
}

export function appointmentDate(appointment: AppointmentLike): string {
  return appointment.scheduledStart
    ? formatAppointmentDate(appointment.scheduledStart)
    : appointment.requestedDate || 'Date to be confirmed'
}

export function isPastAppointment(appointment: AppointmentLike, now = Date.now()): boolean {
  const start = appointment.scheduledStart
    ? new Date(appointment.scheduledStart)
    : appointment.requestedDate
      ? new Date(`${appointment.requestedDate}T${appointment.requestedTime || '00:00'}:00+08:00`)
      : null
  return start && !Number.isNaN(start.getTime()) ? start.getTime() <= now : false
}

export function appointmentTime(appointment: AppointmentLike): string {
  return appointment.scheduledStart
    ? formatAppointmentTime(appointment.scheduledStart, appointment.scheduledEnd)
    : appointment.requestedTime || 'Time to be confirmed'
}

export function therapistName(therapist?: TherapistLike): string {
  if (!therapist) return 'To be assigned'
  return (
    `${therapist.firstname || therapist.firstName || ''} ${
      therapist.lastname || therapist.lastName || ''
    }`.trim() || 'Assigned therapist'
  )
}

export function formatDateTimeManila(value: DateValue): string {
  if (!value) return ''
  const date = toDate(value)
  if (!date) return String(value)

  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || ''
  return `${get('weekday')}, ${get('month')} ${get('day')} · ${get('hour')}:${get('minute')} ${get('dayPeriod')}`
}

export function formatRequestedDateTimeManila(
  date: string | null | undefined,
  time?: string | null,
): string {
  if (!date) return ''
  return formatDateTimeManila(`${date}T${time || '00:00'}`)
}

export function formatDateManila(value: DateValue): string {
  if (!value) return ''
  const date = toDate(value)
  if (!date) return String(value)

  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || ''
  return `${get('weekday')}, ${get('month')} ${get('day')}`
}

export function formatTimeManila(value: DateValue): string {
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

export function relativeTime(value: string | Date): string {
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const absolute = Math.abs(seconds)
  if (absolute < 60) return formatter.format(seconds, 'second')
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (absolute < 86400) return formatter.format(Math.round(seconds / 3600), 'hour')
  return formatter.format(Math.round(seconds / 86400), 'day')
}
