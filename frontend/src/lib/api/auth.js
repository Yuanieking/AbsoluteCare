import axiosInstance from './client'

function asApiError(error) {
  return error ?? {}
}

export const authenticate = (mode, payload) => {
  if (mode !== 'login' && mode !== 'signup') {
    throw new Error(`Unsupported authentication mode: ${mode}`)
  }

  return axiosInstance.post(`/auth/${mode}`, payload)
}

export const requestPasswordReset = (email, recaptchaToken) =>
  axiosInstance.post(
    '/auth/forgot-password',
    recaptchaToken ? { email, recaptchaToken } : { email },
  )

export const resetPassword = (payload) => axiosInstance.post('/auth/reset-password', payload)

export const changePassword = (payload) => axiosInstance.patch('/auth/change-password', payload)

export const updateNotificationPreferences = (payload) =>
  axiosInstance.patch('/auth/notification-preferences', payload)

export const getGoogleAuthRedirectUrl = async () => {
  const response = await axiosInstance.get('/auth/google')
  return response.data.redirectUrl
}

export const completeGoogleSignup = (payload) =>
  axiosInstance.post('/auth/google/complete', payload)

export const getGoogleSession = (token) =>
  axiosInstance.get('/auth/google/session', {
    headers: { Authorization: `Bearer ${token}` },
  })

export const isNetworkError = (error) => {
  const details = asApiError(error)
  return (
    !details.response &&
    (details.code === 'ERR_NETWORK' ||
      /network error/i.test(details.message || '') ||
      /ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(details.message || ''))
  )
}

function toFieldErrors(rawErrors) {
  const fieldErrors = {}
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

export const getApiErrorDetails = (error) => {
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

export const getApiErrorMessage = (error) => getApiErrorDetails(error).message
