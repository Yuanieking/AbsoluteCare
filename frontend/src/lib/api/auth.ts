import axiosInstance from './client'

export type AuthMode = 'login' | 'signup'

export type UserRole = 'patient' | 'therapist' | 'secretary' | 'admin'

export type AuthUser = {
  id?: string
  _id?: string
  userId?: string
  firstName?: string
  lastName?: string
  firstname?: string
  lastname?: string
  email?: string
  role?: UserRole | 'user'
  profilePicture?: string | null
  phone?: string
  dateOfBirth?: string
  address?: string
  createdAt?: string
  isGuardian?: boolean
  authProvider?: string
  notificationPreferences?: Record<string, unknown>
}

export type AuthPayload = {
  email: string
  password: string
  recaptchaToken?: string
  firstName?: string
  lastName?: string
  confirmPassword?: string
  phone?: string
  acceptedTerms?: boolean
}

export type AuthResponse = {
  user?: AuthUser | null
  pending?: boolean
  message?: string
}

export type GoogleSignupPayload = {
  token: string
  firstName?: string
  lastName?: string
  terms?: boolean
  recaptchaToken?: string
}

type ApiIssue = { path?: string | string[]; message?: string }

type ApiErrorBody = {
  message?: string
  code?: string
  errors?: ApiIssue[]
  issues?: ApiIssue[]
}

type ApiErrorLike = {
  code?: string
  message?: string
  config?: { baseURL?: string }
  response?: { status?: number; data?: ApiErrorBody }
}

export type ApiErrorDetails = {
  isNetwork: boolean
  status: number
  code: string
  fieldErrors: Record<string, string>
  message: string
}

function asApiError(error: unknown): ApiErrorLike {
  return (error ?? {}) as ApiErrorLike
}

export const authenticate = (mode: AuthMode, payload: AuthPayload) => {
  if (mode !== 'login' && mode !== 'signup') {
    throw new Error(`Unsupported authentication mode: ${mode}`)
  }

  return axiosInstance.post<AuthResponse>(`/auth/${mode}`, payload)
}

export const requestPasswordReset = (email: string, recaptchaToken?: string) =>
  axiosInstance.post(
    '/auth/forgot-password',
    recaptchaToken ? { email, recaptchaToken } : { email },
  )

export const resetPassword = (payload: { token: string; password: string }) =>
  axiosInstance.post('/auth/reset-password', payload)

export const changePassword = (payload: { password: string; confirmPassword: string }) =>
  axiosInstance.patch<AuthResponse>('/auth/change-password', payload)

export const updateNotificationPreferences = (payload: Record<string, unknown>) =>
  axiosInstance.patch('/auth/notification-preferences', payload)

export const getGoogleAuthUrl = () => `${axiosInstance.defaults.baseURL}/auth/google`

export const completeGoogleSignup = (payload: GoogleSignupPayload) =>
  axiosInstance.post<AuthResponse>('/auth/google/complete', payload)

export const getGoogleSession = (token: string) =>
  axiosInstance.get<AuthResponse>('/auth/google/session', {
    headers: { Authorization: `Bearer ${token}` },
  })

export const isNetworkError = (error: unknown) => {
  const details = asApiError(error)
  return (
    !details.response &&
    (details.code === 'ERR_NETWORK' ||
      /network error/i.test(details.message || '') ||
      /ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(details.message || ''))
  )
}

function toFieldErrors(rawErrors: ApiIssue[] | undefined) {
  const fieldErrors: Record<string, string> = {}
  if (!Array.isArray(rawErrors)) return fieldErrors
  for (const issue of rawErrors) {
    const pathArray = Array.isArray(issue?.path)
      ? issue.path
      : typeof issue?.path === 'string'
        ? [issue.path]
        : []
    const field = pathArray[0]
    if (!field || typeof issue?.message !== 'string') continue
    if (!fieldErrors[field]) fieldErrors[field] = issue.message
  }
  return fieldErrors
}

export const getApiErrorDetails = (error: unknown): ApiErrorDetails => {
  const details = asApiError(error)
  if (isNetworkError(error)) {
    const baseURL = details.config?.baseURL || axiosInstance.defaults.baseURL || ''
    return {
      isNetwork: true,
      status: 0,
      code: details.code || 'ERR_NETWORK',
      fieldErrors: {},
      message: `Cannot reach the API at ${baseURL}. Is the backend running (npm run dev in backend/, default http://localhost:8080)?`,
    }
  }
  const data = details.response?.data || {}
  return {
    isNetwork: false,
    status: details.response?.status || 0,
    code: data.code || '',
    fieldErrors: toFieldErrors(data.errors || data.issues),
    message: data.message || details.message || 'Unable to complete authentication.',
  }
}

export const getApiErrorMessage = (error: unknown) => getApiErrorDetails(error).message
