import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/useNotifications";
import { relativeTime } from "../../utils/patientFormatters";
import Skeleton from "../loading/Skeleton";

const icons = {
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
};

function getLink(item, role) {
  if (item.link) return item.link;
  if (!item.appointment?._id)
    return role === "patient"
      ? "/dashboard/notifications"
      : `/staff/${role}/notifications`;
  return role === "patient"
    ? `/dashboard/appointments/${item.appointment._id}`
    : `/staff/${role}/appointments/${item.appointment._id}`;
}

function Item({ notification, onOpen, onToggle, onDismiss }) {
  const Icon = icons[notification.type] || Bell;
  return (
    <div
      className={`notification-item${notification.isRead ? "" : " is-unread"}`}
    >
      <button
        type="button"
        className="notification-item-main"
        onClick={() => onOpen(notification)}
      >
        <span
          className={`notification-item-icon notification-type-${notification.type}`}
        >
          <Icon size={17} />
        </span>
        <span className="notification-item-copy">
          <strong>{notification.title}</strong>
          <span>{notification.message}</span>
          <small
            title={new Date(notification.createdAt).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
            })}
          >
            {relativeTime(notification.createdAt)}
          </small>
        </span>
        {!notification.isRead && (
          <span className="notification-unread-dot" aria-label="Unread" />
        )}
      </button>
      <span className="notification-item-actions">
        <button
          type="button"
          onClick={() => onToggle(notification)}
          aria-label={notification.isRead ? "Mark as unread" : "Mark as read"}
        >
          <CheckCheck size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDismiss(notification)}
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </span>
    </div>
  );
}

export default function NotificationBell({ role = "patient" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
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
  } = useNotifications();

  useEffect(() => {
    const reset = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(reset);
  }, [location.pathname, location.search]);

  useEffect(() => {
    function close(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function escape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) loadNotifications({ unread: filter === "unread" });
  }

  async function openNotification(item) {
    try {
      await markRead(item);
      setOpen(false);
      navigate(getLink(item, role));
    } catch {
      /* context reports rollback */
    }
  }

  function changeFilter(value) {
    setFilter(value);
    loadNotifications({ unread: value === "unread" });
  }
  const visible = notifications.slice(0, 5);
  const settingsLink =
    role === "patient" ? "/settings" : `/staff/${role}/settings`;
  const allLink =
    role === "patient"
      ? "/dashboard/notifications"
      : `/staff/${role}/notifications`;

  return (
    <div className="notification-wrap" ref={wrapperRef}>
      <button
        className="icon-button notification-button"
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount > 9 ? "9+" : unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={19} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="notification-count">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="popover notification-popover"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="notification-popover-head">
            <div>
              <strong>Notifications</strong>
              {unreadCount > 0 && (
                <span className="notification-header-count">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="notification-popover-head-actions">
              <button
                type="button"
                onClick={markAllRead}
                disabled={!unreadCount}
              >
                Mark all as read
              </button>
              <Link to={settingsLink} aria-label="Notification settings">
                <Settings2 size={16} />
              </Link>
            </div>
          </div>
          <div
            className="notification-filter"
            role="tablist"
            aria-label="Notification filter"
          >
            {[
              ["all", "All"],
              ["unread", "Unread"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={filter === key ? "is-active" : ""}
                onClick={() => changeFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {loading && !visible.length ? (
            <div className="notification-loading">
              {[1, 2, 3].map((item) => (
                <Skeleton
                  key={item}
                  variant="text"
                  width="100%"
                  height="52px"
                />
              ))}
            </div>
          ) : error && !visible.length ? (
            <div className="notification-inline-state">
              <p>{error}</p>
              <button
                type="button"
                onClick={() =>
                  loadNotifications({ unread: filter === "unread" })
                }
              >
                Try again
              </button>
            </div>
          ) : visible.length ? (
            <div className="notification-popover-list">
              {visible.map((item) => (
                <Item
                  key={item._id}
                  notification={item}
                  onOpen={openNotification}
                  onToggle={(entry) =>
                    entry.isRead ? markUnread(entry) : markRead(entry)
                  }
                  onDismiss={dismiss}
                />
              ))}
            </div>
          ) : (
            <div className="notification-empty-state">
              <span>
                <Bell size={20} />
              </span>
              <strong>You’re all caught up</strong>
              <p>New updates about your appointments will show up here.</p>
            </div>
          )}
          <Link className="notification-popover-footer" to={allLink}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
