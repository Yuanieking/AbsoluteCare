export const EMAIL_ERROR = 'Enter a valid email address, e.g. name@gmail.com'
export const PHONE_ERROR = 'Enter a valid mobile number (e.g. 09171234567)'

export const EMAIL_MAX_LENGTH = 254
const emailPattern =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
const phonePattern = /^(?:09\d{9}|\+639\d{9})$/

export function isValidEmail(value: unknown): boolean {
  const email = String(value || '').trim()
  if (email.length > EMAIL_MAX_LENGTH) return false
  const [local = ''] = email.split('@')
  return local.length <= 64 && emailPattern.test(email)
}

export function sanitizePhone(value: unknown): string {
  return String(value || '').replace(/[^\d+\s-]/g, '')
}

export function normalizePhone(value: unknown): string {
  const compact = String(value || '').replace(/[\s-]/g, '')
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`
  if (/^\+639\d{9}$/.test(compact)) return compact
  return compact
}

export function isValidPhone(value: unknown): boolean {
  return phonePattern.test(normalizePhone(value))
}
