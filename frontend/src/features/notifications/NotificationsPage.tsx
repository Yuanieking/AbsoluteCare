import { Bell, CheckCheck, RefreshCw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageBody, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/session'
import { useNotifications } from '@/features/notifications/provider'
import { relativeTime } from '@/lib/format/patient'
import { showError } from '@/lib/toast'

type NotificationItem = {
  _id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
  appointment?: { _id?: string } | null
}

type NotificationsValue = {
  notifications: NotificationItem[]
  unreadCount: number
  loading: boolean
  error: string
  nextCursor: string | null
  loadNotifications: (options?: { unread?: boolean; append?: boolean }) => Promise<void>
  markRead: (item: NotificationItem) => Promise<void>
  markUnread: (item: NotificationItem) => Promise<void>
  markAllRead: () => Promise<void>
  dismiss: (item: NotificationItem) => Promise<void>
}

function getLink(item: NotificationItem, role: string) {
  if (item.link) return item.link
  if (!item.appointment?._id) {
    return role === 'patient' ? '/dashboard/notifications' : `/staff/${role}/notifications`
  }
  return role === 'patient'
    ? `/dashboard/appointments/${item.appointment._id}`
    : `/staff/${role}/appointments/${item.appointment._id}`
}

const typeFilters = [
  { value: 'all', label: 'All updates' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'payments', label: 'Payments' },
  { value: 'system', label: 'System' },
]

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role || 'patient'
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const {
    notifications,
    unreadCount,
    loading,
    error,
    nextCursor,
    loadNotifications,
    markRead,
    markUnread,
    markAllRead,
    dismiss,
  } = useNotifications() as unknown as NotificationsValue

  useEffect(() => {
    void loadNotifications({ unread: filter === 'unread' })
  }, [filter, loadNotifications])

  const visible = useMemo(() => {
    if (typeFilter === 'all') return notifications
    return notifications.filter((item) =>
      typeFilter === 'appointments'
        ? item.type.startsWith('appointment') || item.type.startsWith('reschedule')
        : typeFilter === 'payments'
          ? item.type === 'payment_recorded'
          : ['system', 'account_update'].includes(item.type),
    )
  }, [notifications, typeFilter])

  async function openNotification(item: NotificationItem) {
    try {
      await markRead(item)
      navigate(getLink(item, role))
    } catch {
      showError('That notification could not be opened.')
    }
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Your updates"
        title="Notifications"
        description="Keep up with appointment changes, reminders, and account updates."
      />

      <section className="mt-5 overflow-hidden rounded-lg border border-hairline bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-in px-4 py-3">
          <div
            role="group"
            aria-label="Notification filters"
            className="flex items-center gap-1 rounded-md bg-sunk p-1"
          >
            {(
              [
                ['all', 'All'],
                ['unread', `Unread${unreadCount ? ` (${unreadCount})` : ''}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={[
                  'inline-flex h-8 items-center rounded-sm px-2.5 text-[12.5px] font-medium transition-colors',
                  filter === key
                    ? 'bg-panel text-ink shadow-[0_1px_2px_rgba(26,29,28,0.06)]'
                    : 'text-ink-soft hover:text-ink',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
              Type
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-8 rounded-md border border-hairline bg-panel px-2 text-[12.5px] text-ink focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {typeFilters.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void markAllRead()}
              disabled={!unreadCount}
            >
              <CheckCheck size={15} aria-hidden="true" /> Mark all as read
            </Button>
          </div>
        </div>

        {loading && !notifications.length ? (
          <div className="grid gap-2 p-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} className="h-[68px] rounded-md" />
            ))}
          </div>
        ) : error && !notifications.length ? (
          <EmptyState
            icon={<RefreshCw size={22} />}
            title="We couldn’t load notifications"
            message={error}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadNotifications({ unread: filter === 'unread' })}
              >
                Try again
              </Button>
            }
          />
        ) : visible.length ? (
          <ul className="divide-y divide-hairline-in">
            {visible.map((item) => (
              <li key={item._id} className={item.isRead ? '' : 'bg-primary-soft/25'}>
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => void openNotification(item)}
                    className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-sunk/60"
                  >
                    <span className="mt-0.5 text-ink-faint" aria-hidden="true">
                      <Bell size={17} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block text-[13px] text-ink">{item.title}</strong>
                      <span className="block text-[12.5px] text-ink-soft">{item.message}</span>
                      <small
                        className="mt-0.5 block text-[11px] text-ink-faint"
                        title={new Date(item.createdAt).toLocaleString('en-PH', {
                          timeZone: 'Asia/Manila',
                        })}
                      >
                        {relativeTime(item.createdAt)}
                      </small>
                    </span>
                    {item.isRead ? null : <span className="sr-only">Unread</span>}
                  </button>
                  <div className="flex items-center gap-1 pr-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={item.isRead ? 'Mark as unread' : 'Mark as read'}
                      onClick={() => void (item.isRead ? markUnread(item) : markRead(item))}
                    >
                      <CheckCheck size={15} aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Dismiss notification"
                      onClick={() => void dismiss(item)}
                    >
                      <X size={15} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Bell size={22} />}
            title="You’re all caught up"
            message="New updates about your appointments will show up here."
          />
        )}

        {nextCursor ? (
          <div className="border-t border-hairline-in p-3 text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadNotifications({ unread: filter === 'unread', append: true })}
            >
              Load more
            </Button>
          </div>
        ) : null}
      </section>
    </PageBody>
  )
}
