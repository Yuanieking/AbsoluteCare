import { formatSchedule, scheduleOf } from '@/lib/availability'
import { clinicDate } from '@/lib/format/clinic-time'
import { visitAmount } from '@/lib/payments'

const dateTime = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
})

const timeOnly = new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
})

const dateOnly = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Manila',
})

const dayOnly = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatDay(value) {
  return dayOnly.format(new Date(`${value}T00:00:00Z`))
}

export function personName(person) {
  const first = person?.firstname || person?.firstName || ''
  const last = person?.lastname || person?.lastName || ''
  return `${first} ${last}`.trim()
}

export function patientName(appointment) {
  return personName(appointment?.patient) || 'Unnamed patient'
}

export function therapistName(appointment) {
  return personName(appointment?.therapist) || 'Unassigned'
}

export function serviceName(appointment) {
  return appointment?.service?.name || appointment?.serviceSnapshot?.name || 'Therapy'
}

export function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDateTime(value) {
  if (!value) return 'Not set'
  const date = clinicDate(value)
  return Number.isNaN(date.getTime()) ? String(value) : dateTime.format(date)
}

export function formatTime(value) {
  if (!value) return '—'
  const date = clinicDate(value)
  return Number.isNaN(date.getTime()) ? String(value) : timeOnly.format(date)
}

export function formatDate(value) {
  if (!value) return 'Not set'
  const date = clinicDate(value)
  return Number.isNaN(date.getTime()) ? String(value) : dateOnly.format(date)
}

export function formatDuration(value) {
  return value ? `${value} min` : 'Not recorded'
}

export function appointmentStart(appointment) {
  if (appointment.scheduledStart) return appointment.scheduledStart
  if (appointment.requestedDate) {
    return `${appointment.requestedDate}T${appointment.requestedTime || '00:00'}:00+08:00`
  }
  return null
}

/** Same rule as the server and reports: collected when paid, booked fee when unpaid. */
export function appointmentFee(appointment) {
  return visitAmount(appointment)
}

export function isPastConfirmed(appointment) {
  if (appointment.status !== 'confirmed' || !appointment.scheduledEnd) return false
  return new Date(appointment.scheduledEnd) <= new Date()
}

export const PAST_DUE_REASON =
  'The requested time has already passed. Cancel this request or ask the patient to book a new time.'

/** A pending request whose requested start time is already in the past. */
export function isPastDue(appointment, now = new Date()) {
  if (appointment.status !== 'pending') return false
  const start = appointmentStart(appointment)
  return Boolean(start) && clinicDate(start) <= now
}

/** Completed and no-show unlock at the start, for both roles. */
export function hasStarted(appointment) {
  if (appointment.status !== 'confirmed') return false
  const start = appointmentStart(appointment)
  return Boolean(start) && new Date(start) <= new Date()
}

const statusLabels = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export function appointmentStatusLabel(status) {
  return (status && statusLabels[status]) || status || 'Unknown'
}

const roleLabels = {
  admin: 'Admin',
  therapist: 'Therapist',
  secretary: 'Secretary',
  patient: 'Patient',
  user: 'Patient',
}

export function roleLabel(role) {
  return (role && roleLabels[role]) || 'Unknown'
}

export function isPendingApproval(user) {
  if (!user) return false
  if (user.role === 'patient' || user.role === 'user') return false
  if (user.isActive || user.isArchived || user.removedAt) return false
  const audit = user.accountAudit || []
  return !audit.some((entry) => entry.action === 'activated')
}

export function accountStatus(user) {
  if (!user) return 'unknown'
  if (user.removedAt) return 'removed'
  if (user.isArchived) return 'archived'
  if (isPendingApproval(user)) return 'pending-approval'
  return user.isActive ? 'active' : 'deactivated'
}

export function specializationList(user) {
  const value = user?.specialization
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

export function workingDaysLabel(user) {
  return formatSchedule(scheduleOf(user))
}

/** Who moved this therapist's schedule last, for the dialog's audit line. */
export function lastAvailabilityAudit(user) {
  const entry = [...(user?.accountAudit || [])]
    .reverse()
    .find((item) => item.action?.startsWith('availability-updated'))
  if (!entry) return 'No schedule changes recorded yet'
  const by =
    typeof entry.by === 'string' ? 'a clinic admin' : personName(entry.by) || 'a clinic admin'
  return `Last updated by ${by} · ${formatDate(entry.at)}`
}

/** Helper text for the required note when a visit is (or stays) unpaid. */
export function unpaidReasonHelp(currentStatus) {
  return currentStatus === 'paid'
    ? 'Required — explain why this paid visit is being marked unpaid.'
    : 'Required — note why payment is still outstanding.'
}
