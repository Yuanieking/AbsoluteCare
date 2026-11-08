import axios, { type AxiosError } from 'axios'
import { showError } from '@/lib/toast'
import { queryClient } from './query-client'
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

// ** Timestamp concurrency: remember the newest updatedAt seen for every record _id in any
// ** response, then send it back as If-Match on PATCH/DELETE to that record. The server
// ** answers 409 STALE_RECORD if someone else changed the record in between.
// ponytail: unbounded per-tab map of id -> timestamp; fine for a session, prune if it ever matters
const seenUpdatedAt = new Map<string, string>()
let selfId = ''
const objectIdInPath = /\/([a-f\d]{24})(?:\/|$)/i
// ** Own-account routes carry no id in the URL; they target the signed-in user.
const selfPaths =
  /^\/(auth\/(profile|notification-preferences|change-password)|therapist\/(profile|availability)|secretary\/profile)$/

function rememberTimestamps(value: unknown, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return
  if (Array.isArray(value)) {
    for (const item of value) rememberTimestamps(item, depth + 1)
    return
  }
  const record = value as Record<string, unknown>
  const { _id: id, updatedAt } = record
  // ** Keep the newest only: a slow GET must not overwrite a fresher write response.
  if (typeof id === 'string' && typeof updatedAt === 'string') {
    const previous = seenUpdatedAt.get(id)
    if (!previous || previous < updatedAt) seenUpdatedAt.set(id, updatedAt)
  }
  for (const child of Object.values(record)) rememberTimestamps(child, depth + 1)
}

axiosInstance.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  if (method !== 'patch' && method !== 'delete') return config
  const path = (config.url ?? '').split('?')[0] ?? ''
  const id = selfPaths.test(path) ? selfId : objectIdInPath.exec(path)?.[1]
  const updatedAt = id && seenUpdatedAt.get(id)
  if (updatedAt) config.headers.set('If-Match', `"${updatedAt}"`)
  return config
})

axiosInstance.interceptors.response.use(
  (response) => {
    rememberTimestamps(response.data)
    const user = (response.data as { user?: { _id?: unknown } } | undefined)?.user
    if (response.config.url?.startsWith('/auth/') && typeof user?._id === 'string')
      selfId = user._id
    return response
  },
  (error: AxiosError<{ message?: string; code?: string }>) => {
    // ** 409 STALE_RECORD: refetch so the next attempt carries the latest timestamp. The page
    // ** still shows the server's message through its own error toast.
    if (error.response?.status === 409 && error.response.data?.code === 'STALE_RECORD') {
      void queryClient.invalidateQueries()
    }
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
