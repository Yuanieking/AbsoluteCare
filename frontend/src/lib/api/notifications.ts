import axiosInstance from './client'

export type ApiNotification = {
  _id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
  appointment?: { _id?: string } | null
}

type NotificationPage = {
  notifications?: ApiNotification[]
  nextCursor?: string | null
}

type NotificationQuery = {
  limit?: number
  unread?: boolean
  cursor?: string
}

export const getNotifications = (params: NotificationQuery = {}) =>
  axiosInstance.get<NotificationPage>('/notifications', { params })

export const getUnreadNotificationCount = () =>
  axiosInstance.get<{ count?: number }>('/notifications/unread-count')

export const markNotificationRead = (id: string) => axiosInstance.patch(`/notifications/${id}/read`)

export const markNotificationUnread = (id: string) =>
  axiosInstance.patch(`/notifications/${id}/unread`)

export const markAllNotificationsRead = () => axiosInstance.patch('/notifications/read-all')

export const deleteNotification = (id: string) => axiosInstance.delete(`/notifications/${id}`)

export const clearReadNotifications = () => axiosInstance.delete('/notifications')
