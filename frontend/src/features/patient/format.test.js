import { expect, test, vi } from 'vitest'
import { ageLabel, buildWeek, monthlySessionSeries, nextVisitLabel } from './format'

const now = new Date('2026-10-29T02:00:00Z')

test('ageLabel turns the birthday boundary correctly', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 29, 10, 0, 0))
  try {
    expect(ageLabel('2018-10-29')).toBe('8 years')
    expect(ageLabel('2018-10-30')).toBe('7 years')
    expect(ageLabel('2025-10-29')).toBe('1 year')
    expect(ageLabel('')).toBe('Age unavailable')
  } finally {
    vi.useRealTimers()
  }
})

test('buildWeek marks today, weekends and visit days', () => {
  const week = buildWeek(
    [{ _id: 'a', status: 'confirmed', scheduledStart: '2026-10-31T01:00:00Z' }],
    now,
  )
  expect(week).toHaveLength(7)
  expect(week[0]).toMatchObject({ key: '2026-10-29', isToday: true })
  expect(week[1]).toMatchObject({ key: '2026-10-30', isWeekend: false, hasVisit: false })
  expect(week[2]).toMatchObject({ key: '2026-10-31', isWeekend: true, hasVisit: true })
})

test('nextVisitLabel falls back when nothing is scheduled', () => {
  expect(
    nextVisitLabel({
      _id: 'd',
      firstName: 'Ana',
      lastName: 'Cruz',
      dateOfBirth: '2015-01-01',
      relationship: 'Child',
    }),
  ).toBe('No upcoming appointments')
})

test('monthlySessionSeries buckets the last six Manila months', () => {
  const series = monthlySessionSeries(
    [
      { sessionDate: '2026-10-02T02:00:00Z' },
      { sessionDate: '2026-10-20T02:00:00Z' },
      { sessionDate: '2026-07-10T02:00:00Z' },
    ],
    now,
  )
  expect(series).toHaveLength(6)
  expect(series.map((point) => point.label)).toEqual([
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
  ])
  expect(series.at(-1)?.value).toBe(2)
  expect(series.at(-4)?.value).toBe(1)
})
