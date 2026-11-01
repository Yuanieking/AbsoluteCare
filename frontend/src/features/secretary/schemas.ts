import { z } from 'zod'
import { PHONE_ERROR, isValidPhone } from '@/lib/validation'

const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter a ${label}.`)
    .refine((value) => !/\d/.test(value), 'Names cannot contain numbers.')

export const paymentSchema = z
  .object({
    status: z.enum(['paid', 'unpaid']),
    amount: z.string(),
    method: z.enum(['cash', 'gcash', 'card', 'other']),
    referenceNumber: z.string(),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.status === 'unpaid') {
      if (!values.notes.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['notes'],
          message: 'A reason is required when marking payment unpaid.',
        })
      }
      return
    }
    if (!/^\d+(\.\d{1,2})?$/.test(values.amount.trim()) || Number(values.amount) <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Enter an amount greater than zero.',
      })
    }
    if (values.method !== 'cash' && !values.referenceNumber.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['referenceNumber'],
        message: 'A reference number is required for this payment method.',
      })
    }
  })

export const secretaryProfileSchema = z.object({
  firstname: requiredName('first name'),
  lastname: requiredName('last name'),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || isValidPhone(value), PHONE_ERROR),
  profilePicture: z
    .string()
    .trim()
    .refine(
      (value) => !value || value.startsWith('http') || value.startsWith('data:image/'),
      'Enter an image URL.',
    ),
})

export type PaymentValues = z.infer<typeof paymentSchema>
export type SecretaryProfileValues = z.infer<typeof secretaryProfileSchema>
