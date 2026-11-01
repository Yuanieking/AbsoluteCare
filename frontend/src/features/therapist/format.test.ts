import { expect, test } from 'vitest'
import { matchesTab, monthlySeries, patientName, tabCounts, todaysSchedule } from './format'
import type { Appointment } from './types'

const now = new Date('2026-10-29T02:00:00Z').getTime()

const appointment = (overrides: Partial<Appointment>): Appointment => ({
  _id: overrides._id ?? 'a',
  status: overrides.status ?? 'confirmed',
  ...overrides,
})

const records: Appointment[] = [
  appointment({ _id: 'today', scheduledStart: '2026-10-29T01:00:00Z' }),
  appointment({ _id: 'later', scheduledStart: '2026-11-02T01:00:00Z', status: 'pending' }),
  appointment({ _id: 'done', scheduledStart: '2026-10-20T01:00:00Z', status: 'completed' }),
  appointment({ _id: 'gone', status: 'cancelled' }),
]

test('tabs split upcoming and previous without double counting', () => {
  expect(tabCounts(records, now)).toEqual({ total: 4, upcoming: 1, previous: 3 })
  expect(matchesTab(records[2]!, 'upcoming', now)).toBe(false)
  expect(matchesTab(records[3]!, 'upcoming', now)).toBe(false)
})

test('todaysSchedule keeps only Manila-today visits, in time order', () => {
  const schedule = todaysSchedule(records, new Date(now))
  expect(schedule.map((item) => item._id)).toEqual(['today'])
})

test('patientName prefers the populated patient and falls back', () => {
  expect(patientName(appointment({ patient: { firstname: 'Ana', lastname: 'Cruz' } }))).toBe(
    'Ana Cruz',
  )
  expect(patientName(appointment({ patient: { firstName: 'Ana', lastName: 'Reyes' } }))).toBe(
    'Ana Reyes',
  )
  expect(patientName(null)).toBe('Patient')
})

test('monthlySeries buckets the last six Manila months', () => {
  const series = monthlySeries(
    [
      { date: '2026-10-02T02:00:00Z' },
      { date: '2026-10-20T02:00:00Z' },
      { date: '2026-05-01T02:00:00Z' },
    ],
    (item) => item.date,
    new Date(now),
  )
  expect(series.map((point) => point.label)).toEqual([
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
  ])
  expect(series.at(-1)?.value).toBe(2)
  expect(series[0]?.value).toBe(1)
})
