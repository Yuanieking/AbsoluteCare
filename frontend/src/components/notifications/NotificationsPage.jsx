import { Bell, CheckCheck, ChevronDown, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../dashboard/PageHeader";
import { DashboardEmptyState } from "../dashboard/DashboardPrimitives";
import Skeleton from "../loading/Skeleton";
import { useAuth } from "../../context/useAuth";
import { useNotifications } from "../../context/useNotifications";
import { relativeTime } from "../../utils/patientFormatters";
import { showError } from "../../utils/toast";

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

function Row({ notification, onOpen, onToggle, onDismiss }) {
  return (
    <div
      className={`notification-page-row${notification.isRead ? "" : " is-unread"}`}
    >
      <button
        type="button"
        className="notification-page-row-main"
        onClick={() => onOpen(notification)}
      >
        <span
          className={`notification-item-icon notification-type-${notification.type}`}
        >
          <Bell size={17} />
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
      <div className="notification-page-row-actions">
        <button
          type="button"
          onClick={() => onToggle(notification)}
          aria-label={notification.isRead ? "Mark as unread" : "Mark as read"}
        >
          <CheckCheck size={15} />
        </button>
        <button
          type="button"
          onClick={() => onDismiss(notification)}
          aria-label="Dismiss notification"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || "patient";
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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
  } = useNotifications();

  useEffect(() => {
    loadNotifications({ unread: filter === "unread" });
  }, [filter, loadNotifications]);

  const visible = useMemo(() => {
    if (typeFilter === "all") return notifications;
    return notifications.filter((item) =>
      typeFilter === "appointments"
        ? item.type.startsWith("appointment") ||
          item.type.startsWith("reschedule")
        : typeFilter === "payments"
          ? item.type === "payment_recorded"
          : ["system", "account_update"].includes(item.type),
    );
  }, [notifications, typeFilter]);

  async function openNotification(item) {
    try {
      await markRead(item);
      navigate(getLink(item, role));
    } catch {
      showError("That notification could not be opened.");
    }
  }

  const patient = role === "patient";
  return (
    <main className={patient ? "dashboard-content" : "staff-dashboard-content"}>
      <PageHeader
        eyebrow="YOUR UPDATES"
        title="Notifications"
        description="Keep up with appointment changes, reminders, and account updates."
      />
      <section className="notification-page-card">
        <div className="notification-page-toolbar">
          <div
            className="notification-filter"
            role="tablist"
            aria-label="Notification filters"
          >
            {[
              ["all", "All"],
              ["unread", `Unread${unreadCount ? ` (${unreadCount})` : ""}`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={filter === key ? "is-active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="notification-page-actions">
            <label className="notification-type-filter">
              Type{" "}
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="all">All updates</option>
                <option value="appointments">Appointments</option>
                <option value="payments">Payments</option>
                <option value="system">System</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <button
              type="button"
              className="subtle-action"
              onClick={markAllRead}
              disabled={!unreadCount}
            >
              <CheckCheck size={15} /> Mark all as read
            </button>
          </div>
        </div>
        {loading && !notifications.length ? (
          <div className="notification-page-skeleton">
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} variant="text" width="100%" height="68px" />
            ))}
          </div>
        ) : error && !notifications.length ? (
          <DashboardEmptyState
            icon={<RefreshCw size={22} />}
            title="We couldn’t load notifications"
            message={error}
            action={
              <button
                type="button"
                className="dashboard-primary-button"
                onClick={() =>
                  loadNotifications({ unread: filter === "unread" })
                }
              >
                Try again
              </button>
            }
          />
        ) : visible.length ? (
          <div className="notification-page-list">
            {visible.map((item) => (
              <Row
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
          <DashboardEmptyState
            icon={<Bell size={22} />}
            title="You’re all caught up"
            message="New updates about your appointments will show up here."
          />
        )}
        {nextCursor && (
          <button
            type="button"
            className="notification-load-more"
            onClick={() =>
              loadNotifications({ unread: filter === "unread", append: true })
            }
          >
            Load more
          </button>
        )}
      </section>
    </main>
  );
}
