import { z } from 'zod'
import { EMAIL_ERROR, PHONE_ERROR, isValidEmail, isValidPhone } from '@/lib/validation'

const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter a ${label}.`)
    .refine((value) => !/\d/.test(value), 'Names cannot contain numbers.')

const phone = z
  .string()
  .trim()
  .refine((value) => !value || isValidPhone(value), PHONE_ERROR)

const email = z
  .string()
  .trim()
  .refine((value) => isValidEmail(value), EMAIL_ERROR)

export const adminProfileSchema = z.object({
  firstName: requiredName('first name'),
  lastName: requiredName('last name'),
  phone,
  address: z.string().trim().max(240),
  profilePicture: z
    .string()
    .trim()
    .refine(
      (value) => !value || value.startsWith('http') || value.startsWith('data:image/'),
      'Enter an image URL.',
    ),
})

export const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const userSchema = z
  .object({
    firstname: requiredName('first name'),
    lastname: requiredName('last name'),
    email,
    role: z.enum(['patient', 'therapist', 'secretary', 'admin']),
    phone,
    passwordMode: z.enum(['auto', 'manual']),
    password: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.passwordMode === 'manual' && values.password.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Manual passwords must be at least 8 characters.',
      })
    }
  })

export const personSchema = z.object({
  firstname: requiredName('first name'),
  lastname: requiredName('last name'),
  email,
  phone,
  dateOfBirth: z.string(),
  address: z.string().trim(),
  profilePicture: z
    .string()
    .trim()
    .refine(
      (value) => !value || value.startsWith('http') || value.startsWith('data:image/'),
      'Enter an image URL.',
    ),
  specialization: z.array(z.string()),
})

export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Enter a service name.'),
  description: z.string().trim(),
  category: z.string().trim(),
  duration: z
    .string()
    .trim()
    .refine((value) => Number(value) > 0, 'Enter a duration in minutes.'),
  fee: z
    .string()
    .trim()
    .refine((value) => value === '' || Number(value) >= 0, 'Enter a fee of zero or more.'),
})

export const assignSchema = z.object({
  therapistId: z.string().min(1, 'Select a therapist.'),
  note: z.string().trim(),
})

export const rescheduleSchema = z.object({
  newDate: z.string().min(1, 'Choose a new date.'),
  newTime: z.string().regex(timePattern, 'Choose a new time.'),
  reason: z.string().trim(),
})

export const cancelSchema = z.object({
  reason: z.string().min(1, 'Choose a reason.'),
  notes: z.string().trim().min(1, 'Add context for the record.'),
})

export const notifySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Write a message.')
    .max(500, 'Keep the message under 500 characters.'),
})

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
  })

export type AdminProfileValues = z.infer<typeof adminProfileSchema>
export type UserValues = z.infer<typeof userSchema>
export type PersonValues = z.infer<typeof personSchema>
export type ServiceValues = z.infer<typeof serviceSchema>
export type AssignValues = z.infer<typeof assignSchema>
export type RescheduleValues = z.infer<typeof rescheduleSchema>
export type CancelValues = z.infer<typeof cancelSchema>
export type NotifyValues = z.infer<typeof notifySchema>
export type PaymentValues = z.infer<typeof paymentSchema>
