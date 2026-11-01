import { expect, test } from 'vitest'
import {
  accountStatus,
  appointmentFee,
  appointmentStart,
  isPastConfirmed,
  workingDaysLabel,
} from './format'
import type { AdminAppointment } from './types'

const base: AdminAppointment = { _id: 'a1', status: 'pending' }

test('a request without a scheduled slot falls back to its requested date and time', () => {
  expect(appointmentStart({ ...base, requestedDate: '2026-03-02', requestedTime: '09:30' })).toBe(
    '2026-03-02T09:30:00+08:00',
  )
  expect(appointmentStart({ ...base, scheduledStart: '2026-03-01T01:00:00.000Z' })).toBe(
    '2026-03-01T01:00:00.000Z',
  )
  expect(appointmentStart(base)).toBeNull()
})

test('a recorded payment amount wins over the booked service fee', () => {
  expect(appointmentFee({ ...base, service: { fee: 1200 }, payment: { amount: 800 } })).toBe(800)
  expect(appointmentFee({ ...base, serviceSnapshot: { fee: 1200 } })).toBe(1200)
  expect(appointmentFee(base)).toBe(0)
})

test('only a confirmed visit whose end time has passed counts as past', () => {
  const past = new Date(Date.now() - 60_000).toISOString()
  const future = new Date(Date.now() + 60_000).toISOString()
  expect(isPastConfirmed({ ...base, status: 'confirmed', scheduledEnd: past })).toBe(true)
  expect(isPastConfirmed({ ...base, status: 'confirmed', scheduledEnd: future })).toBe(false)
  expect(isPastConfirmed({ ...base, status: 'pending', scheduledEnd: past })).toBe(false)
})

test('account state follows removal, archive, approval and activation order', () => {
  expect(accountStatus({ _id: 'u1', removedAt: '2026-01-01', isArchived: true })).toBe('removed')
  expect(accountStatus({ _id: 'u2', isArchived: true })).toBe('archived')
  expect(accountStatus({ _id: 'u3', role: 'therapist' })).toBe('pending-approval')
  expect(accountStatus({ _id: 'u4', role: 'patient' })).toBe('deactivated')
  expect(accountStatus({ _id: 'u5', isActive: true })).toBe('active')
})

test('the availability label collapses consecutive days that share hours', () => {
  const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
  expect(
    workingDaysLabel({
      _id: 'u1',
      workingHoursByDay: [
        ...week.map((day) => ({ day, start: '08:00', end: '17:00' })),
        { day: 'Sat' as const, start: '09:00', end: '12:00' },
      ],
    }),
  ).toBe('Mon–Fri 08:00–17:00 · Sat 09:00–12:00')
  expect(
    workingDaysLabel({
      _id: 'u2',
      workingDays: ['Mon', 'Wed'],
      workingHours: { start: '10:00', end: '14:00' },
    }),
  ).toBe('Mon 10:00–14:00 · Wed 10:00–14:00')
  expect(workingDaysLabel({ _id: 'u3' })).toBe('No working days set')
})
