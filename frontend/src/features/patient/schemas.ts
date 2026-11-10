import { z } from 'zod'
import { todayInManila } from '@/lib/format/patient'
import { PHONE_ERROR, isValidPhone } from '@/lib/validation'

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const futureDate = z
  .string()
  .min(1, 'Choose a date.')
  .regex(datePattern, 'Choose a valid date.')
  .refine((value) => value >= todayInManila(), 'Choose a future date.')

const dateOfBirth = z
  .string()
  .min(1, 'Choose a date of birth.')
  .regex(datePattern, 'Choose a valid date.')
  .refine((value) => value <= todayInManila(), 'Date of birth cannot be in the future.')
  .refine((value) => value >= '1900-01-01', 'Choose a date after 1900.')

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter a ${label}.`)
    .refine((value) => !/\d/.test(value), 'Names cannot contain numbers.')

export const bookingSchema = z.object({
  service: z.string().min(1, 'Choose a therapy service.'),
  requestedDate: futureDate,
  requestedTime: z.string().regex(timePattern, 'Choose a valid time.'),
  dependent: z.string(),
  notes: z.string().max(1000, 'Keep notes under 1000 characters.'),
})

export const rescheduleSchema = z.object({
  proposedDate: futureDate,
  proposedTime: z.string().regex(timePattern, 'Choose a valid time.'),
  reason: z.string().max(500, 'Keep the reason under 500 characters.'),
})

export const dependentSchema = z.object({
  firstName: name('first name'),
  lastName: name('last name'),
  dateOfBirth,
  relationship: z.string().min(1, 'Choose a relationship.'),
  medicalNotes: z.string().max(1000, 'Keep notes under 1000 characters.'),
})

export const profileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(80, 'Keep names to 80 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(80, 'Keep names to 80 characters or fewer.'),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || isValidPhone(value), PHONE_ERROR),
  dateOfBirth: z
    .string()
    .refine(
      (value) => !value || value <= todayInManila(),
      'Date of birth cannot be in the future.',
    ),
  address: z.string().max(240, 'Keep the address to 240 characters or fewer.'),
  profilePicture: z.string(),
})

export type BookingValues = z.infer<typeof bookingSchema>
export type RescheduleValues = z.infer<typeof rescheduleSchema>
export type DependentValues = z.infer<typeof dependentSchema>
export type ProfileValues = z.infer<typeof profileSchema>
