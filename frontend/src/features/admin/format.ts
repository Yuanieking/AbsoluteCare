import { formatSchedule, scheduleOf } from '@/lib/availability'
import type { AdminAppointment, PersonRef, UserAccount } from './types'

const dateTime = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
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

export function formatDay(value: string) {
  return dayOnly.format(new Date(`${value}T00:00:00Z`))
}

export function personName(person?: PersonRef | null) {
  const first = person?.firstname || person?.firstName || ''
  const last = person?.lastname || person?.lastName || ''
  return `${first} ${last}`.trim()
}

export function patientName(appointment?: AdminAppointment | null) {
  return personName(appointment?.patient) || 'Unnamed patient'
}

export function therapistName(appointment?: AdminAppointment | null) {
  return personName(appointment?.therapist) || 'Unassigned'
}

export function serviceName(appointment?: AdminAppointment | null) {
  return appointment?.service?.name || appointment?.serviceSnapshot?.name || 'Therapy'
}

export function formatMoney(value?: number | null) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : dateTime.format(date)
}

export function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : timeOnly.format(date)
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : dateOnly.format(date)
}

export function formatDuration(value?: number | null) {
  return value ? `${value} min` : 'Not recorded'
}

export function appointmentStart(appointment: AdminAppointment) {
  if (appointment.scheduledStart) return appointment.scheduledStart
  if (appointment.requestedDate) {
    return `${appointment.requestedDate}T${appointment.requestedTime || '00:00'}:00+08:00`
  }
  return null
}

export function appointmentFee(appointment: AdminAppointment) {
  return Number(
    appointment.payment?.amount ??
      appointment.serviceSnapshot?.fee ??
      appointment.service?.fee ??
      0,
  )
}

export function isPastConfirmed(appointment: AdminAppointment) {
  if (appointment.status !== 'confirmed' || !appointment.scheduledEnd) return false
  return new Date(appointment.scheduledEnd) <= new Date()
}

/** Completed and no-show unlock at the start, for both roles. */
export function hasStarted(appointment: AdminAppointment) {
  if (appointment.status !== 'confirmed') return false
  const start = appointmentStart(appointment)
  return Boolean(start) && new Date(start as string) <= new Date()
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export function appointmentStatusLabel(status?: string | null) {
  return (status && statusLabels[status]) || status || 'Unknown'
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  therapist: 'Therapist',
  secretary: 'Secretary',
  patient: 'Patient',
  user: 'Patient',
}

export function roleLabel(role?: string | null) {
  return (role && roleLabels[role]) || 'Unknown'
}

export function isPendingApproval(user?: UserAccount | null) {
  if (!user) return false
  if (user.role === 'patient' || user.role === 'user') return false
  if (user.isActive || user.isArchived || user.removedAt) return false
  const audit = user.accountAudit || []
  return !audit.some((entry) => entry.action === 'activated')
}

export function accountStatus(user?: UserAccount | null) {
  if (!user) return 'unknown'
  if (user.removedAt) return 'removed'
  if (user.isArchived) return 'archived'
  if (isPendingApproval(user)) return 'pending-approval'
  return user.isActive ? 'active' : 'deactivated'
}

export function specializationList(user?: UserAccount | null) {
  const value = user?.specialization
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

export function workingDaysLabel(user?: UserAccount | null) {
  return formatSchedule(scheduleOf(user))
}

/** Who moved this therapist's schedule last, for the dialog's audit line. */
export function lastAvailabilityAudit(user?: UserAccount | null) {
  const entry = [...(user?.accountAudit || [])]
    .reverse()
    .find((item) => item.action?.startsWith('availability-updated'))
  if (!entry) return 'No schedule changes recorded yet'
  const by =
    typeof entry.by === 'string' ? 'a clinic admin' : personName(entry.by) || 'a clinic admin'
  return `Last updated by ${by} · ${formatDate(entry.at)}`
}
