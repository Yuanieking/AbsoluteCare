import { describe, expect, it } from 'vitest'
import { forgotPasswordSchema, loginSchema, signupSchema } from './schemas'

const base = {
  firstName: 'Ana',
  lastName: 'Reyes',
  email: 'ana@gmail.com',
  role: 'patient' as const,
  password: 'Passw0rd!',
  confirmPassword: 'Passw0rd!',
  terms: true,
}

describe('auth schemas', () => {
  it('requires a valid email and password to log in', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'ana@gmail.com', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'ana@gmail.com', password: 'x' }).success).toBe(true)
  })

  it('accepts an empty phone but rejects a malformed one', () => {
    const schema = signupSchema(8)
    expect(schema.safeParse({ ...base, phone: '' }).success).toBe(true)
    expect(schema.safeParse({ ...base, phone: '09171234567' }).success).toBe(true)
    expect(schema.safeParse({ ...base, phone: '12345' }).success).toBe(false)
  })

  it('requires matching passwords and accepted terms', () => {
    const schema = signupSchema(8)
    expect(schema.safeParse({ ...base, confirmPassword: 'other' }).success).toBe(false)
    expect(schema.safeParse({ ...base, terms: false }).success).toBe(false)
    expect(schema.safeParse(base).success).toBe(true)
  })

  it('enforces the configured minimum password length', () => {
    const schema = signupSchema(12)
    expect(
      schema.safeParse({ ...base, password: 'Passw0rd!', confirmPassword: 'Passw0rd!' }).success,
    ).toBe(false)
  })

  it('validates reset-link emails', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'ana@gmail.com' }).success).toBe(true)
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false)
  })
})
