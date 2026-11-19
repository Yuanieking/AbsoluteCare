import { describe, expect, it } from 'vitest'
import { visitAmount } from './payments'

describe('visitAmount', () => {
  it('shows the booked fee for an unpaid visit whose collected amount is 0', () => {
    expect(
      visitAmount({ payment: { status: 'unpaid', amount: 0 }, serviceSnapshot: { fee: 1300 }, service: { fee: 1300 } }),
    ).toBe(1300)
  })

  it('shows what was collected once a visit is paid', () => {
    expect(visitAmount({ payment: { status: 'paid', amount: 1000 }, serviceSnapshot: { fee: 1300 } })).toBe(1000)
  })

  it('falls back to the current fee only when nothing was booked', () => {
    expect(visitAmount({ payment: { status: 'unpaid', amount: 0 }, serviceSnapshot: { fee: 0 }, service: { fee: 900 } })).toBe(900)
    expect(visitAmount({})).toBe(0)
  })
})
