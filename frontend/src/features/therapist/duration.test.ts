import { describe, expect, it } from 'vitest'
import { serviceSchema } from '@/features/admin/schemas'
import { sessionSchema } from './schemas'

describe('Therapy duration policy', () => {
  it('requires at least 30 whole minutes for services and session records', () => {
    for (const duration of ['1', '29', '30.5']) {
      expect(serviceSchema.safeParse({ name: 'Therapy', description: '', category: '', fee: '0', duration }).success).toBe(false)
      expect(sessionSchema.safeParse({ sessionDate: '2020-01-01', durationMinutes: duration, clinicalNotes: 'Notes', patientVisibleNotes: '' }).success).toBe(false)
    }
    expect(serviceSchema.safeParse({ name: 'Therapy', description: '', category: '', fee: '0', duration: '30' }).success).toBe(true)
    expect(sessionSchema.safeParse({ sessionDate: '2020-01-01', durationMinutes: '30', clinicalNotes: 'Notes', patientVisibleNotes: '' }).success).toBe(true)
  })
})
