import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CalendarCheck2,
  CalendarClock,
  CheckCheck,
  CircleX,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardEmptyState } from "../../components/dashboard/DashboardPrimitives";
import { getApiErrorMessage } from "../../services/api/authApi";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/api/patientApi";
import { relativeTime } from "../../utils/patientFormatters";
import { TableSkeleton } from "../../components/loading/Skeleton";

function NotificationIcon({ type }) {
  if (type === "appointment_cancelled") return <CircleX size={16} />;
  if (type === "appointment_reminder") return <CalendarClock size={16} />;
  return <CalendarCheck2 size={16} />;
}

function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async function load() {
    setLoading(true);
    try {
      const response = await getNotifications();
      setNotifications(response.data?.notifications || []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(load, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  async function openNotification(notification) {
    if (!notification.isRead) {
      await markNotificationRead(notification._id);
      setNotifications((current) =>
        current.map((item) =>
          item._id === notification._id ? { ...item, isRead: true } : item,
        ),
      );
    }
    if (notification.appointment?._id)
      navigate(`/dashboard/appointments/${notification.appointment._id}`);
  }

  async function markAll() {
    await markAllNotificationsRead();
    setNotifications((current) =>
      current.map((item) => ({ ...item, isRead: true })),
    );
  }

  return (
    <main className="dashboard-content">
      <section className="dashboard-section patient-page-section">
        <div className="section-title-row">
          <div>
            <p className="dashboard-eyebrow">Stay informed</p>
            <h1>Notifications</h1>
          </div>
          <button className="subtle-action" type="button" onClick={markAll}>
            <CheckCheck size={15} /> Mark all as read
          </button>
        </div>
        {loading ? (
          <TableSkeleton rows={5} columns={1} />
        ) : error ? (
          <DashboardEmptyState
            icon={<RefreshCw size={22} />}
            title="We couldn’t load notifications"
            message={error}
            action={
              <button
                className="dashboard-primary-button"
                type="button"
                onClick={load}
              >
                Try again
              </button>
            }
          />
        ) : notifications.length ? (
          <div className="notification-list">
            {notifications.map((notification) => (
              <button
                key={notification._id}
                type="button"
                className={`notification-list-item${notification.isRead ? "" : " is-unread"}`}
                onClick={() => openNotification(notification)}
              >
                <span className="notification-list-icon">
                  <NotificationIcon type={notification.type} />
                </span>
                <span>
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <small>{relativeTime(notification.createdAt)}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <DashboardEmptyState
            icon={<Bell size={22} />}
            title="You’re all caught up"
            message="Appointment updates and reminders will appear here."
          />
        )}
      </section>
    </main>
  );
}

export default NotificationsPage;
