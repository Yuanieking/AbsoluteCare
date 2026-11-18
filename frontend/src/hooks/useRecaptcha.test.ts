import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecaptcha } from './useRecaptcha'

const state = vi.hoisted(() => ({ value: undefined as unknown }))
vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
  useState: (initial: unknown) => {
    if (state.value === undefined) state.value = initial
    return [
      state.value,
      (value: unknown) => {
        state.value = value
      },
    ]
  },
}))

const reset = vi.fn()
const options = { enabled: true, siteKey: 'saved-key', recaptchaRef: { current: { reset } } }

beforeEach(() => {
  state.value = undefined
  reset.mockClear()
})

describe('CAPTCHA state', () => {
  it('invalidates a rejected token and exposes the exact inline message', () => {
    useRecaptcha(options).setToken('verified-token')
    expect(useRecaptcha(options).handleError('RECAPTCHA_FAILED')).toBe(true)
    expect(useRecaptcha(options)).toMatchObject({ token: null, error: 'Invalid CAPTCHA' })
    expect(reset).toHaveBeenCalledOnce()
    useRecaptcha(options).setToken('retry-token')
    expect(useRecaptcha(options)).toMatchObject({ token: 'retry-token', error: '' })
  })

  it('keeps ordinary login failures separate from CAPTCHA failures', () => {
    useRecaptcha(options).setToken('verified-token')
    expect(useRecaptcha(options).handleError('INVALID_CREDENTIALS')).toBe(false)
    expect(useRecaptcha(options)).toMatchObject({ token: 'verified-token', error: '' })
    expect(reset).not.toHaveBeenCalled()
  })

  it('keeps temporary verification failures distinct from invalid CAPTCHA', () => {
    useRecaptcha(options).handleError('RECAPTCHA_UNAVAILABLE')
    expect(useRecaptcha(options).error).toBe("We couldn't verify you right now. Please try again.")
  })

  it('does not reuse tokens or errors when saved keys change or CAPTCHA is disabled', () => {
    useRecaptcha(options).setToken('old-key-token')
    expect(useRecaptcha({ ...options, siteKey: 'new-key' }).token).toBeNull()
    useRecaptcha(options).handleError('RECAPTCHA_FAILED')
    expect(useRecaptcha({ ...options, siteKey: 'new-key' }).error).toBe('')
    expect(useRecaptcha({ ...options, enabled: false })).toMatchObject({
      enabled: false,
      token: null,
      error: '',
    })
  })
})
