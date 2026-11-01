import axios, { type AxiosError } from 'axios'
import { showError } from '@/lib/toast'
import { canHandleSessionExpiry, markSessionExpiryHandled } from './session'

const sessionCheckPaths = [
  '/auth/me',
  '/auth/login',
  '/auth/staff/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/change-password',
  '/auth/logout',
  '/settings/public',
]

function isAuthRequest(url = '') {
  const path = url.split('?')[0] ?? url
  return sessionCheckPaths.includes(path) || path.startsWith('/auth/google')
}

const rawBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const normalizedBaseURL = String(rawBaseURL || '')
  .trim()
  .replace(/\/+$/, '')

const axiosInstance = axios.create({
  baseURL: normalizedBaseURL || 'http://localhost:8080',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (
      error.response?.status === 401 &&
      !isAuthRequest(error.config?.url) &&
      canHandleSessionExpiry()
    ) {
      markSessionExpiryHandled()
      showError('Your session has expired. Please log in again.', {
        id: 'session-expired',
      })
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export default axiosInstance
