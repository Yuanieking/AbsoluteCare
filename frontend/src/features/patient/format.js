import { appointmentDate, appointmentTime } from '@/lib/format/patient'
import { clinicDay } from '@/lib/format/clinic-time'

export function dependentName(dependent) {
  return `${dependent.firstName || ''} ${dependent.lastName || ''}`.trim() || 'Unnamed dependent'
}

export function initials(first = '', last = '') {
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || 'D'
}

export function therapistInitials(therapist) {
  if (!therapist) return ''
  return initials(
    therapist.firstname || therapist.firstName,
    therapist.lastname || therapist.lastName,
  )
}

export function ageLabel(dateOfBirth) {
  if (!dateOfBirth) return 'Age unavailable'
  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return 'Age unavailable'

  const today = new Date(`${clinicDay()}T00:00:00Z`)
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear()
  const birthdayPassed =
    today.getUTCMonth() > birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() >= birthDate.getUTCDate())
  if (!birthdayPassed) age -= 1
  return `${Math.max(age, 0)} ${age === 1 ? 'year' : 'years'}`
}

export function dateLabel(value) {
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

export function nextVisitLabel(dependent) {
  const appointment = dependent.nextAppointment
  if (!appointment) return 'No upcoming appointments'
  return `${appointmentDate(appointment)} · ${appointmentTime(appointment)} · ${
    appointment.service?.name || 'Therapy'
  }`
}

function manilaDateKey(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function buildWeek(appointments, now = new Date()) {
  const [year = 1970, month = 1, day = 1] = manilaDateKey(now).split('-').map(Number)
  const visitDays = new Set(
    appointments
      .filter((appointment) => appointment.scheduledStart)
      .map((appointment) => manilaDateKey(appointment.scheduledStart)),
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

export function monthlySessionSeries(sessions, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  })
  const months = Array.from({ length: 6 }, (_, index) =>
    new Date(
      Date.UTC(
        Number(clinicDay(now).slice(0, 4)),
        Number(clinicDay(now).slice(5, 7)) - 1 - (5 - index),
        1,
      ),
    )
      .toISOString()
      .slice(0, 7),
  )
  return months.map((month) => ({
    label: month,
    value: sessions.filter(
      (session) => formatter.format(new Date(session.sessionDate)).slice(0, 7) === month,
    ).length,
  }))
}
