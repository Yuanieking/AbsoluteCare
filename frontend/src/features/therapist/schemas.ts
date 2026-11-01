import { z } from 'zod'
import { todayInManila } from '@/lib/format/patient'
import { PHONE_ERROR, isValidPhone } from '@/lib/validation'

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter a ${label}.`)
    .refine((value) => !/\d/.test(value), 'Names cannot contain numbers.')

export const rescheduleSchema = z.object({
  proposedDate: z
    .string()
    .min(1, 'Choose a date.')
    .regex(datePattern, 'Choose a valid date.')
    .refine((value) => value >= todayInManila(), 'Choose a future date.'),
  proposedTime: z.string().regex(timePattern, 'Choose a valid time.'),
  reason: z
    .string()
    .trim()
    .min(1, 'Add a short reason for the patient.')
    .max(500, 'Keep the reason under 500 characters.'),
})

export const sessionSchema = z.object({
  sessionDate: z
    .string()
    .min(1, 'Choose the session date.')
    .regex(datePattern, 'Choose a valid date.')
    .refine((value) => value <= todayInManila(), 'The session date cannot be in the future.'),
  durationMinutes: z
    .string()
    .trim()
    .min(1, 'Enter the duration.')
    .refine(
      (value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 240,
      'Enter between 1 and 240 minutes.',
    ),
  patientVisibleNotes: z.string().trim().max(4000, 'Keep the notes under 4000 characters.'),
  clinicalNotes: z
    .string()
    .trim()
    .min(1, 'Add the clinical notes.')
    .max(4000, 'Keep the notes under 4000 characters.'),
})

export const therapistProfileSchema = z.object({
  firstname: requiredName('first name'),
  lastname: requiredName('last name'),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || isValidPhone(value), PHONE_ERROR),
  address: z.string(),
  profilePicture: z
    .string()
    .trim()
    .refine(
      (value) => !value || value.startsWith('http') || value.startsWith('data:image/'),
      'Enter an image URL.',
    ),
})

export type RescheduleValues = z.infer<typeof rescheduleSchema>
export type SessionValues = z.infer<typeof sessionSchema>
export type TherapistProfileValues = z.infer<typeof therapistProfileSchema>
