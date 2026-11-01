import { expect, test } from 'vitest'
import { collectedSeries, formatMoney, patientName, paymentLabel, todaySchedule } from './format'
import type { SecretaryAppointment } from './types'

const now = new Date('2026-10-29T02:00:00Z')

const appointment = (overrides: Partial<SecretaryAppointment>): SecretaryAppointment => ({
  _id: overrides._id ?? 'a',
  status: overrides.status ?? 'confirmed',
  ...overrides,
})

test('formatMoney uses two decimals and a peso sign', () => {
  expect(formatMoney(1500)).toBe('₱1,500.00')
  expect(formatMoney(0)).toBe('₱0.00')
  expect(formatMoney()).toBe('₱0.00')
})

test('paymentAmount falls back to the service fee', () => {
  expect(paymentLabel(appointment({ payment: { status: 'paid', amount: 800 } }))).toBe(
    'Paid · ₱800.00',
  )
  expect(paymentLabel(appointment({ service: { fee: 1200 } }))).toBe('Unpaid · ₱1,200.00')
})

test('patientName prefers the dependent attending the visit', () => {
  expect(
    patientName(
      appointment({
        patient: { firstname: 'Ana', lastname: 'Cruz' },
        dependent: { firstName: 'Lia', lastName: 'Cruz' },
      }),
    ),
  ).toBe('Lia Cruz')
  expect(patientName(appointment({ patient: { firstname: 'Ana', lastname: 'Cruz' } }))).toBe(
    'Ana Cruz',
  )
})

test('todaySchedule keeps only Manila-today visits, in time order', () => {
  const schedule = todaySchedule(
    [
      appointment({ _id: 'later', scheduledStart: '2026-10-29T06:00:00Z' }),
      appointment({ _id: 'early', scheduledStart: '2026-10-29T01:00:00Z' }),
      appointment({ _id: 'tomorrow', scheduledStart: '2026-10-30T01:00:00Z' }),
      appointment({ _id: 'undated' }),
    ],
    now,
  )
  expect(schedule.map((item) => item._id)).toEqual(['early', 'later'])
})

test('collectedSeries sums paid amounts into the last six Manila months', () => {
  const series = collectedSeries(
    [
      appointment({ payment: { status: 'paid', amount: 500, recordedAt: '2026-10-05T02:00:00Z' } }),
      appointment({ payment: { status: 'paid', amount: 750, recordedAt: '2026-10-20T02:00:00Z' } }),
      appointment({ payment: { status: 'paid', amount: 300, recordedAt: '2026-08-01T02:00:00Z' } }),
      appointment({
        payment: { status: 'unpaid', amount: 999 },
        scheduledStart: '2026-10-10T02:00:00Z',
      }),
      appointment({ scheduledStart: '2026-01-10T02:00:00Z' }),
    ],
    now,
  )
  expect(series.at(-1)).toEqual({ label: '2026-10', value: 1250 })
  expect(series.at(-3)).toEqual({ label: '2026-08', value: 300 })
})
