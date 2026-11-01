import { expect, test } from 'vitest'
import { paymentSchema } from './schemas'

const values = (overrides: Record<string, string> = {}) => ({
  status: 'paid',
  amount: '1500',
  method: 'cash',
  referenceNumber: '',
  notes: '',
  ...overrides,
})

test('a cash payment needs only a positive amount', () => {
  expect(paymentSchema.safeParse(values()).success).toBe(true)
  expect(paymentSchema.safeParse(values({ amount: '0' })).success).toBe(false)
})

test('non-cash methods require a reference number', () => {
  const result = paymentSchema.safeParse(values({ method: 'gcash' }))
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.path).toEqual(['referenceNumber'])
})

test('marking a visit unpaid requires a reason but no amount', () => {
  expect(paymentSchema.safeParse(values({ status: 'unpaid' })).success).toBe(false)
  expect(
    paymentSchema.safeParse(values({ status: 'unpaid', amount: '', notes: 'Refunded in cash.' }))
      .success,
  ).toBe(true)
})
