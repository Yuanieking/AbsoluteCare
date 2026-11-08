import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticate } from '@/lib/api/auth'
import type { SignupValues } from './schemas'
import { SignupForm } from './SignupForm'

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  setUser: vi.fn(),
  submit: null as ((values: SignupValues) => Promise<void>) | null,
}))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => state.navigate,
}))
vi.mock('react-hook-form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-hook-form')>()
  return {
    ...actual,
    useForm: (...args: Parameters<typeof actual.useForm>) => {
      const form = actual.useForm(...args)
      const handleSubmit = form.handleSubmit
      return {
        ...form,
        handleSubmit: (...submitArgs: Parameters<typeof handleSubmit>) => {
          state.submit = submitArgs[0] as typeof state.submit
          return handleSubmit(...submitArgs)
        },
      }
    },
  }
})
vi.mock('@/features/auth/session', () => ({ useAuth: () => ({ setUser: state.setUser }) }))
vi.mock('@/features/settings/provider', () => ({
  useSettings: () => ({
    settings: { passwordMinLength: 8, recaptchaEnabled: false, googleAuthEnabled: false },
    loading: false,
    refreshSettings: vi.fn(),
  }),
}))
vi.mock('@/hooks/useRecaptcha', () => ({
  useRecaptcha: () => ({ enabled: false, reset: vi.fn() }),
}))
vi.mock('@/lib/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/auth')>()),
  authenticate: vi.fn(),
}))

const values: SignupValues = {
  firstName: 'Test',
  lastName: 'Patient',
  email: 'patient@example.com',
  phone: '09171234567',
  password: 'SecurePass123',
  confirmPassword: 'SecurePass123',
  terms: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[{ pathname: '/signup', state: { from: '/appointments' } }]}>
      <SignupForm isStaffAlias={false} />
    </MemoryRouter>,
  )
})

describe('Signup session', () => {
  it('Signs in the returned patient and goes straight to their dashboard without a second login', async () => {
    const user = { _id: 'patient-id', role: 'user' as const, email: values.email }
    vi.mocked(authenticate).mockResolvedValue({ data: { user } } as Awaited<ReturnType<typeof authenticate>>)

    await state.submit!(values)

    expect(authenticate).toHaveBeenCalledExactlyOnceWith('signup', {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      password: values.password,
      confirmPassword: values.confirmPassword,
      acceptedTerms: true,
    })
    expect(state.setUser).toHaveBeenCalledExactlyOnceWith(user)
    expect(state.navigate).toHaveBeenCalledExactlyOnceWith('/dashboard', { replace: true })
    expect(state.setUser.mock.invocationCallOrder[0]).toBeLessThan(state.navigate.mock.invocationCallOrder[0]!)
  })

  it('Does not establish a session or navigate when approval is pending', async () => {
    vi.mocked(authenticate).mockResolvedValue({
      data: { pending: true, user: { role: 'user' }, message: 'Approval is required.' },
    } as Awaited<ReturnType<typeof authenticate>>)

    await state.submit!(values)

    expect(state.setUser).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('Does not navigate when no authenticated user is returned', async () => {
    vi.mocked(authenticate).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof authenticate>>)

    await state.submit!(values)

    expect(state.setUser).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('Keeps server-side signup restrictions instead of attempting another login', async () => {
    vi.mocked(authenticate).mockRejectedValue({
      response: { status: 403, data: { message: 'Registration is currently closed.' } },
    })

    await state.submit!(values)

    expect(authenticate).toHaveBeenCalledTimes(1)
    expect(state.setUser).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()
  })
})
