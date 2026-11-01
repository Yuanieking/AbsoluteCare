/* eslint-disable react-refresh/only-export-components -- provider and hook stay together */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/features/auth/session'
import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead as markAllRequest,
  markNotificationRead as markReadRequest,
  markNotificationUnread as markUnreadRequest,
  type ApiNotification,
} from '@/lib/api/notifications'
import { showError, showInfo } from '@/lib/toast'

export type NotificationItem = ApiNotification

type LoadOptions = { unread?: boolean; append?: boolean }

type NotificationsValue = {
  notifications: NotificationItem[]
  unreadCount: number
  loading: boolean
  error: string
  nextCursor: string | null
  loadNotifications: (options?: LoadOptions) => Promise<void>
  refreshCount: (announce?: boolean) => Promise<void>
  markRead: (item: NotificationItem) => Promise<void>
  markUnread: (item: NotificationItem) => Promise<void>
  markAllRead: () => Promise<void>
  dismiss: (item: NotificationItem) => Promise<void>
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

function apiMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } } | null)?.response?.data
    ?.message
  return message || fallback
}

function replaceNotification(
  items: NotificationItem[],
  id: string,
  update: Partial<NotificationItem>,
) {
  return items.map((item) => (item._id === id ? { ...item, ...update } : item))
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const nextCursorRef = useRef<string | null>(null)
  const previousCount = useRef<number | null>(null)
  const userId = user?.id

  const refreshCount = useCallback(
    async (announce = true) => {
      if (!userId || document.hidden) return
      try {
        const response = await getUnreadNotificationCount()
        const nextCount: number = response.data?.count || 0
        if (announce && previousCount.current !== null && nextCount > previousCount.current) {
          showInfo('New notification')
        }
        previousCount.current = nextCount
        setUnreadCount(nextCount)
      } catch {}
    },
    [userId],
  )

  const loadNotifications = useCallback(
    async ({ unread, append = false }: LoadOptions = {}) => {
      if (!userId) return
      setLoading(true)
      setError('')
      try {
        const response = await getNotifications({
          limit: 20,
          ...(unread === undefined ? {} : { unread }),
          ...(append && nextCursorRef.current ? { cursor: nextCursorRef.current } : {}),
        })
        const incoming: NotificationItem[] = response.data?.notifications || []
        setNotifications((current) => (append ? [...current, ...incoming] : incoming))
        const cursor: string | null = response.data?.nextCursor || null
        nextCursorRef.current = cursor
        setNextCursor(cursor)
        await refreshCount(false)
      } catch (requestError) {
        setError(apiMessage(requestError, 'Unable to load notifications.'))
      } finally {
        setLoading(false)
      }
    },
    [refreshCount, userId],
  )

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      setNotifications([])
      setUnreadCount(0)
      setNextCursor(null)
      nextCursorRef.current = null
      setError('')
      previousCount.current = null
      if (!userId) return
      void loadNotifications()
      void refreshCount(false)
    }, 0)
    if (!userId) return () => window.clearTimeout(initialLoad)
    const poll = () => void refreshCount(true)
    const interval = window.setInterval(poll, 30_000)
    const onVisibility = () => {
      if (!document.hidden) {
        void loadNotifications()
        void refreshCount(false)
      }
    }
    const onFocus = () => void refreshCount(false)
    const onOnline = () => void refreshCount(false)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [loadNotifications, refreshCount, userId])

  const markRead = useCallback(async (notification: NotificationItem) => {
    if (notification.isRead) return
    setNotifications((current) => replaceNotification(current, notification._id, { isRead: true }))
    setUnreadCount((count) => Math.max(0, count - 1))
    try {
      await markReadRequest(notification._id)
    } catch (requestError) {
      setNotifications((current) =>
        replaceNotification(current, notification._id, { isRead: false }),
      )
      setUnreadCount((count) => count + 1)
      showError(apiMessage(requestError, 'Could not mark notification as read.'))
      throw requestError
    }
  }, [])

  const markUnread = useCallback(async (notification: NotificationItem) => {
    if (!notification.isRead) return
    setNotifications((current) => replaceNotification(current, notification._id, { isRead: false }))
    setUnreadCount((count) => count + 1)
    try {
      await markUnreadRequest(notification._id)
    } catch (requestError) {
      setNotifications((current) =>
        replaceNotification(current, notification._id, { isRead: true }),
      )
      setUnreadCount((count) => Math.max(0, count - 1))
      showError(apiMessage(requestError, 'Could not mark notification as unread.'))
    }
  }, [])

  const markAllRead = useCallback(async () => {
    const previous = notifications
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)
    try {
      await markAllRequest()
    } catch (requestError) {
      setNotifications(previous)
      setUnreadCount(previous.filter((item) => !item.isRead).length)
      showError(apiMessage(requestError, 'Could not mark notifications as read.'))
    }
  }, [notifications])

  const dismiss = useCallback(
    async (notification: NotificationItem) => {
      const previous = notifications
      setNotifications((current) => current.filter((item) => item._id !== notification._id))
      if (!notification.isRead) setUnreadCount((count) => Math.max(0, count - 1))
      try {
        await deleteNotification(notification._id)
      } catch (requestError) {
        setNotifications(previous)
        setUnreadCount(previous.filter((item) => !item.isRead).length)
        showError(apiMessage(requestError, 'Could not dismiss notification.'))
      }
    },
    [notifications],
  )

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        nextCursor,
        loadNotifications,
        refreshCount,
        markRead,
        markUnread,
        markAllRead,
        dismiss,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return context
}
