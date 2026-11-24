import { describe, expect, it } from 'vitest'
import { clinicDate, clinicDay, clinicMonthRange, clinicRange } from './clinic-time'
import { presetRange } from './date-range'
import { formatRequestedDateTimeManila } from './patient'
import { appointmentMoment as therapistMoment } from '@/features/therapist/format'
import { appointmentMoment as secretaryMoment } from '@/features/secretary/format'

describe('Manila wall-clock and UTC conversion', () => {
  it('interprets offset-less clinic inputs in Manila and preserves explicit offsets', () => {
    expect(clinicDate('2026-03-02T09:30').toISOString()).toBe('2026-03-02T01:30:00.000Z')
    expect(clinicDate('2026-03-02').toISOString()).toBe('2026-03-01T16:00:00.000Z')
    expect(clinicDate('2026-03-02T09:30Z').toISOString()).toBe('2026-03-02T09:30:00.000Z')
    expect(formatRequestedDateTimeManila('2026-03-02', '09:30')).toContain('9:30 AM')
    const appointment = {
      _id: 'a',
      status: 'pending',
      requestedDate: '2026-03-02',
      requestedTime: '09:30',
    }
    expect(therapistMoment(appointment)?.toISOString()).toBe('2026-03-02T01:30:00.000Z')
    expect(secretaryMoment(appointment)?.toISOString()).toBe('2026-03-02T01:30:00.000Z')
  })
  it('uses Manila day/month at UTC rollover, including leap years', () => {
    const now = new Date('2026-12-31T16:30Z')
    expect(clinicDay(now)).toBe('2027-01-01')
    expect(presetRange('month', now)).toEqual({ from: '2027-01-01', to: '2027-01-01' })
    expect(clinicRange('2027-01-01', '2027-01-01')).toEqual({
      from: '2026-12-31T16:00:00.000Z',
      to: '2027-01-01T15:59:59.999Z',
    })
    expect(clinicMonthRange('2024-02-16').to).toBe('2024-02-29T15:59:59.999Z')
  })
})
