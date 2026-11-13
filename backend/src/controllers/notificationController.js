import * as notificationService from "../services/notificationService.js";

export async function listNotifications(req, res) {
  const limit = Math.min(
    Math.max(Number.parseInt(String(req.query.limit || "20"), 10), 1),
    50,
  );
  const options = {
    limit,
    unread: req.query.unread === "true",
  };
  if (req.query.cursor) {
    const cursorDate = new Date(String(req.query.cursor));
    if (!Number.isNaN(cursorDate.getTime())) options.cursor = cursorDate;
  }
  const notifications = await notificationService.listNotificationFeed(
    req.user.userId,
    options,
  );
  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  res.json({
    notifications: items,
    nextCursor: hasMore ? items[items.length - 1]?.createdAt : null,
  });
}

export async function unreadNotificationCount(req, res) {
  const count = await notificationService.unreadNotificationCount(
    req.user.userId,
  );
  res.json({ count });
}

export async function markNotificationRead(req, res) {
  const notification = await notificationService.markNotificationRead(
    req.user.userId,
    req.params.id,
    req.get("If-Match"),
  );
  if (!notification) {
    res.status(404).json({ message: "Notification not found." });
    return;
  }
  res.json({ notification });
}

export async function markNotificationUnread(req, res) {
  const notification = await notificationService.markNotificationUnread(
    req.user.userId,
    req.params.id,
    req.get("If-Match"),
  );
  if (!notification) {
    res.status(404).json({ message: "Notification not found." });
    return;
  }
  res.json({ notification });
}

export async function markAllNotificationsRead(req, res) {
  await notificationService.markAllNotificationsRead(req.user.userId);
  res.status(204).send();
}

export async function deleteNotification(req, res) {
  const deleted = await notificationService.deleteNotification(
    req.user.userId,
    req.params.id,
    req.get("If-Match"),
  );
  if (!deleted) {
    res.status(404).json({ message: "Notification not found." });
    return;
  }
  res.status(204).send();
}

export async function clearReadNotifications(req, res) {
  await notificationService.clearReadNotifications(req.user.userId);
  res.status(204).send();
}
