import { useEffect, useState } from 'react'
import {
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CheckCheck,
  CircleDollarSign,
  Settings2,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications, type NotificationItem } from '@/features/notifications/provider'
import { relativeTime } from '@/lib/format/patient'

const icons: Record<string, LucideIcon> = {
  appointment_confirmed: CalendarCheck2,
  appointment_assigned: CalendarCheck2,
  appointment_requested: UserPlus,
  appointment_request: UserPlus,
  appointment_rescheduled: CalendarClock,
  reschedule_requested: CalendarClock,
  reschedule_approved: CalendarCheck2,
  reschedule_declined: CalendarX2,
  appointment_cancelled: CalendarX2,
  appointment_reminder: Bell,
  payment_recorded: CircleDollarSign,
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

function Item({
  notification,
  onOpen,
  onToggle,
  onDismiss,
}: {
  notification: NotificationItem
  onOpen: (item: NotificationItem) => void
  onToggle: (item: NotificationItem) => void
  onDismiss: (item: NotificationItem) => void
}) {
  const Icon = icons[notification.type] ?? Bell
  return (
    <div
      className={`flex items-start gap-1 border-b border-hairline-in px-3 py-2.5 last:border-b-0 ${
        notification.isRead ? '' : 'bg-primary-soft/40'
      }`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        onClick={() => onOpen(notification)}
      >
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-sunk text-ink-soft">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="grid min-w-0 gap-0.5">
          <strong className="truncate text-[12.5px] font-semibold text-ink">
            {notification.title}
          </strong>
          <span className="line-clamp-2 text-[12px] text-ink-soft">{notification.message}</span>
          <small
            className="text-[11px] text-ink-faint"
            title={new Date(notification.createdAt).toLocaleString('en-PH', {
              timeZone: 'Asia/Manila',
            })}
          >
            {relativeTime(notification.createdAt)}
          </small>
        </span>
        {!notification.isRead && (
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
        )}
      </button>
      <span className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => onToggle(notification)}
          aria-label={notification.isRead ? 'Mark as unread' : 'Mark as read'}
          className="inline-flex size-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <CheckCheck className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDismiss(notification)}
          aria-label="Dismiss notification"
          className="inline-flex size-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

export default function NotificationBell({ role = 'patient' }: { role?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const {
    notifications,
    unreadCount,
    loading,
    error,
    loadNotifications,
    markRead,
    markUnread,
    markAllRead,
    dismiss,
  } = useNotifications()

  useEffect(() => {
    const reset = window.setTimeout(() => setOpen(false), 0)
    return () => window.clearTimeout(reset)
  }, [location.pathname, location.search])

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) void loadNotifications({ unread: filter === 'unread' })
  }

  async function openNotification(item: NotificationItem) {
    try {
      await markRead(item)
      setOpen(false)
      navigate(getLink(item, role))
    } catch {}
  }

  function changeFilter(value: 'all' | 'unread') {
    setFilter(value)
    void loadNotifications({ unread: value === 'unread' })
  }

  const visible = notifications.slice(0, 5)
  const settingsLink = role === 'patient' ? '/settings' : `/staff/${role}/settings`
  const allLink = role === 'patient' ? '/dashboard/notifications' : `/staff/${role}/notifications`

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        aria-label={`Notifications${unreadCount ? ', unread items' : ''}`}
        className="relative inline-flex size-10 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell className="size-[19px]" strokeWidth={1.8} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute top-2 right-2.5 size-2 rounded-full border-2 border-canvas bg-primary"
            aria-hidden="true"
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        aria-label="Notifications"
        className="w-[360px] max-w-[calc(100vw-24px)] overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-2 border-b border-hairline px-3 py-2.5">
          <div className="grid">
            <strong className="text-[13px] text-ink">Notifications</strong>
            {unreadCount > 0 && <span className="text-[11px] text-ink-faint">Unread items</span>}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={!unreadCount}
              className="rounded-md px-2 py-1 text-[11.5px] text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
            >
              Mark all as read
            </button>
            <Link
              to={settingsLink}
              aria-label="Notification settings"
              className="inline-flex size-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Settings2 className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Notification filter"
          className="flex gap-1 border-b border-hairline-in px-2 py-1.5"
        >
          {(['all', 'unread'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => changeFilter(key)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium capitalize transition-colors ${
                filter === key
                  ? 'bg-primary-soft text-primary-strong'
                  : 'text-ink-soft hover:bg-ink/5'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {loading && !visible.length ? (
          <div className="grid gap-2 p-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-[52px] w-full" />
            ))}
          </div>
        ) : error && !visible.length ? (
          <div className="grid gap-2 p-4 text-center">
            <p className="text-[12.5px] text-ink-soft">{error}</p>
            <button
              type="button"
              className="text-[12.5px] font-medium text-primary underline"
              onClick={() => void loadNotifications({ unread: filter === 'unread' })}
            >
              Try again
            </button>
          </div>
        ) : visible.length ? (
          <div className="max-h-[360px] overflow-y-auto">
            {visible.map((item) => (
              <Item
                key={item._id}
                notification={item}
                onOpen={(entry) => void openNotification(entry)}
                onToggle={(entry) => void (entry.isRead ? markUnread(entry) : markRead(entry))}
                onDismiss={(entry) => void dismiss(entry)}
              />
            ))}
          </div>
        ) : (
          <div className="grid justify-items-center gap-1 px-4 py-6 text-center">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-sunk text-ink-soft">
              <Bell className="size-4" aria-hidden="true" />
            </span>
            <strong className="text-[12.5px] text-ink">You’re all caught up</strong>
            <p className="text-[11.5px] text-ink-soft">
              New updates about your appointments will show up here.
            </p>
          </div>
        )}

        <Link
          to={allLink}
          className="block border-t border-hairline px-3 py-2.5 text-center text-[12px] font-medium text-primary hover:underline"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  )
}
