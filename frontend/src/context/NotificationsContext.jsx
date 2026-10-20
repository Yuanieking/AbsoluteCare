import { useCallback, useEffect, useRef, useState } from "react";
import { showError, showInfo } from "../utils/toast";
import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead as markAllRequest,
  markNotificationRead as markReadRequest,
  markNotificationUnread as markUnreadRequest,
} from "../services/api/notificationApi";
import { useAuth } from "./useAuth";
import NotificationsContext from "./notificationsContext";

function replaceNotification(items, id, update) {
  return items.map((item) => (item._id === id ? { ...item, ...update } : item));
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const nextCursorRef = useRef(null);
  const previousCount = useRef(null);
  const userId = user?.id || user?._id;

  const refreshCount = useCallback(
    async (announce = true) => {
      if (!userId || document.hidden) return;
      try {
        const response = await getUnreadNotificationCount();
        const nextCount = response.data?.count || 0;
        if (
          announce &&
          previousCount.current !== null &&
          nextCount > previousCount.current
        ) {
          showInfo("New notification");
        }
        previousCount.current = nextCount;
        setUnreadCount(nextCount);
      } catch {
        // Notification polling must never interrupt the current page.
      }
    },
    [userId],
  );

  const loadNotifications = useCallback(
    async ({ unread, append = false } = {}) => {
      if (!userId) return;
      setLoading(true);
      setError("");
      try {
        const response = await getNotifications({
          limit: 20,
          ...(unread === undefined ? {} : { unread }),
          ...(append && nextCursorRef.current
            ? { cursor: nextCursorRef.current }
            : {}),
        });
        const incoming = response.data?.notifications || [];
        setNotifications((current) =>
          append ? [...current, ...incoming] : incoming,
        );
        const cursor = response.data?.nextCursor || null;
        nextCursorRef.current = cursor;
        setNextCursor(cursor);
        await refreshCount(false);
      } catch (requestError) {
        setError(
          requestError?.response?.data?.message ||
            "Unable to load notifications.",
        );
      } finally {
        setLoading(false);
      }
    },
    [refreshCount, userId],
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      setNotifications([]);
      setUnreadCount(0);
      setNextCursor(null);
      nextCursorRef.current = null;
      setError("");
      previousCount.current = null;
      if (!userId) return;
      loadNotifications();
      refreshCount(false);
    }, 0);
    if (!userId) return () => window.clearTimeout(initialLoad);
    const poll = () => refreshCount(true);
    const interval = window.setInterval(poll, 30_000);
    const onVisibility = () => {
      if (!document.hidden) {
        loadNotifications();
        refreshCount(false);
      }
    };
    const onFocus = () => refreshCount(false);
    const onOnline = () => refreshCount(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [loadNotifications, refreshCount, userId]);

  const markRead = useCallback(async (notification) => {
    if (notification.isRead) return;
    setNotifications((current) =>
      replaceNotification(current, notification._id, { isRead: true }),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markReadRequest(notification._id);
    } catch (requestError) {
      setNotifications((current) =>
        replaceNotification(current, notification._id, { isRead: false }),
      );
      setUnreadCount((count) => count + 1);
      showError(
        requestError?.response?.data?.message ||
          "Could not mark notification as read.",
      );
      throw requestError;
    }
  }, []);

  const markUnread = useCallback(async (notification) => {
    if (!notification.isRead) return;
    setNotifications((current) =>
      replaceNotification(current, notification._id, { isRead: false }),
    );
    setUnreadCount((count) => count + 1);
    try {
      await markUnreadRequest(notification._id);
    } catch (requestError) {
      setNotifications((current) =>
        replaceNotification(current, notification._id, { isRead: true }),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      showError(
        requestError?.response?.data?.message ||
          "Could not mark notification as unread.",
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const previous = notifications;
    setNotifications((current) =>
      current.map((item) => ({ ...item, isRead: true })),
    );
    setUnreadCount(0);
    try {
      await markAllRequest();
    } catch (requestError) {
      setNotifications(previous);
      setUnreadCount(previous.filter((item) => !item.isRead).length);
      showError(
        requestError?.response?.data?.message ||
          "Could not mark notifications as read.",
      );
    }
  }, [notifications]);

  const dismiss = useCallback(
    async (notification) => {
      const previous = notifications;
      setNotifications((current) =>
        current.filter((item) => item._id !== notification._id),
      );
      if (!notification.isRead)
        setUnreadCount((count) => Math.max(0, count - 1));
      try {
        await deleteNotification(notification._id);
      } catch (requestError) {
        setNotifications(previous);
        setUnreadCount(previous.filter((item) => !item.isRead).length);
        showError(
          requestError?.response?.data?.message ||
            "Could not dismiss notification.",
        );
      }
    },
    [notifications],
  );

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
  );
}
