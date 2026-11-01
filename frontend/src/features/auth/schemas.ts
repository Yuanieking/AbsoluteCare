import { z } from 'zod'
import { EMAIL_ERROR, PHONE_ERROR, isValidEmail, isValidPhone } from '@/lib/validation'

export const roleSchema = z.enum(['patient', 'therapist', 'secretary', 'admin'])

const emailSchema = z
  .string()
  .trim()
  .min(1, EMAIL_ERROR)
  .refine((value) => isValidEmail(value), EMAIL_ERROR)

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = (minLength: number) =>
  z
    .object({
      firstName: z.string().trim().min(1, 'First name is required'),
      lastName: z.string().trim().min(1, 'Last name is required'),
      phone: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || isValidPhone(value), PHONE_ERROR),
      role: roleSchema,
      email: emailSchema,
      password: z.string().min(minLength, `Password must be at least ${minLength} characters.`),
      confirmPassword: z.string().min(1, 'Confirm your password'),
      terms: z.boolean().refine((value) => value, 'You must agree to continue.'),
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = (minLength: number) =>
  z
    .object({
      password: z.string().min(minLength, `Password must be at least ${minLength} characters.`),
      confirmPassword: z.string().min(1, 'Confirm your password'),
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    })

export const googleSetupSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  role: roleSchema,
  terms: z.boolean().refine((value) => value, 'Accept the terms before creating your account.'),
})

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<ReturnType<typeof signupSchema>>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<ReturnType<typeof resetPasswordSchema>>
export type GoogleSetupValues = z.infer<typeof googleSetupSchema>
