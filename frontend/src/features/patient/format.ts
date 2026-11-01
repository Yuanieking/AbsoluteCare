import { appointmentDate, appointmentTime } from '@/lib/format/patient'
import type { Appointment, Dependent, TherapistRef } from './types'

export function dependentName(dependent: Pick<Dependent, 'firstName' | 'lastName'>) {
  return `${dependent.firstName || ''} ${dependent.lastName || ''}`.trim() || 'Unnamed dependent'
}

export function initials(first = '', last = '') {
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'D'
}

export function therapistInitials(therapist?: TherapistRef | null) {
  if (!therapist) return ''
  return initials(
    therapist.firstname || therapist.firstName,
    therapist.lastname || therapist.lastName,
  )
}

export function ageLabel(dateOfBirth?: string) {
  if (!dateOfBirth) return 'Age unavailable'
  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return 'Age unavailable'

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  if (!birthdayPassed) age -= 1
  return `${Math.max(age, 0)} ${age === 1 ? 'year' : 'years'}`
}

export function dateLabel(value?: string) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date)
}

export function nextVisitLabel(dependent: Dependent) {
  const appointment = dependent.nextAppointment
  if (!appointment) return 'No upcoming appointments'
  return `${appointmentDate(appointment)} · ${appointmentTime(appointment)} · ${
    appointment.service?.name || 'Therapy'
  }`
}

function manilaDateKey(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export type WeekCell = {
  key: string
  weekday: string
  day: number
  isToday: boolean
  isWeekend: boolean
  hasVisit: boolean
}

export function buildWeek(appointments: Appointment[], now = new Date()): WeekCell[] {
  const [year = 1970, month = 1, day = 1] = manilaDateKey(now).split('-').map(Number)
  const visitDays = new Set(
    appointments
      .filter((appointment) => appointment.scheduledStart)
      .map((appointment) => manilaDateKey(appointment.scheduledStart as string)),
  )

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index))
    return {
      key: date.toISOString().slice(0, 10),
      weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date),
      day: date.getUTCDate(),
      isToday: index === 0,
      isWeekend: [0, 6].includes(date.getUTCDay()),
      hasVisit: visitDays.has(date.toISOString().slice(0, 10)),
    }
  })
}

export function monthlySessionSeries(sessions: { sessionDate: string }[], now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  })
  const months = Array.from({ length: 6 }, (_, index) =>
    formatter.format(new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)).slice(0, 7),
  )
  return months.map((month) => ({
    label: month,
    value: sessions.filter(
      (session) => formatter.format(new Date(session.sessionDate)).slice(0, 7) === month,
    ).length,
  }))
}
