import { expect, test } from 'vitest'
import { formatRangeLabel, presetRange } from './date-range'

const now = new Date(2026, 9, 29, 21, 30)

test('presets use the local calendar day, not UTC', () => {
  expect(presetRange('today', now)).toEqual({ from: '2026-10-29', to: '2026-10-29' })
  expect(presetRange('week', now)).toEqual({ from: '2026-10-25', to: '2026-10-29' })
  expect(presetRange('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-29' })
})

test('range labels degrade gracefully when one end is missing', () => {
  expect(formatRangeLabel({ from: '', to: '' })).toBe('Date range')
  expect(formatRangeLabel({ from: '2026-10-01', to: '2026-10-01' })).toBe('2026-10-01')
  expect(formatRangeLabel({ from: '2026-10-01', to: '2026-10-29' })).toBe('2026-10-01 – 2026-10-29')
  expect(formatRangeLabel({ from: '2026-10-01', to: '' })).toBe('From 2026-10-01')
  expect(formatRangeLabel({ from: '', to: '2026-10-29' })).toBe('Until 2026-10-29')
})
