import Notification from "../models/notificationModel.js";

function ownerQuery(req) {
  return { user: req.user.userId };
}

export async function listNotifications(req, res) {
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit || "20", 10), 1),
    50,
  );
  const query = {
    ...ownerQuery(req),
    createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  };
  if (req.query.unread === "true") query.isRead = false;
  if (req.query.cursor) {
    const cursorDate = new Date(req.query.cursor);
    if (!Number.isNaN(cursorDate.getTime())) query.createdAt.$lt = cursorDate;
  }
  const notifications = await Notification.find(query)
    .populate(
      "appointment",
      "status scheduledStart requestedDate requestedTime",
    )
    .populate("dependent", "firstName lastName")
    .sort({ createdAt: -1 })
    .limit(limit + 1);
  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  res.json({
    notifications: items,
    nextCursor: hasMore ? items[items.length - 1]?.createdAt : null,
  });
}

export async function unreadNotificationCount(req, res) {
  const count = await Notification.countDocuments({
    ...ownerQuery(req),
    isRead: false,
  });
  res.json({ count });
}

export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { ...ownerQuery(req), _id: req.params.id },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  );
  if (!notification)
    return res.status(404).json({ message: "Notification not found." });
  res.json({ notification });
}

export async function markNotificationUnread(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { ...ownerQuery(req), _id: req.params.id },
    { $set: { isRead: false, readAt: null } },
    { new: true },
  );
  if (!notification)
    return res.status(404).json({ message: "Notification not found." });
  res.json({ notification });
}

export async function markAllNotificationsRead(req, res) {
  await Notification.updateMany(
    { ...ownerQuery(req), isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  res.status(204).send();
}

export async function deleteNotification(req, res) {
  const result = await Notification.deleteOne({
    ...ownerQuery(req),
    _id: req.params.id,
  });
  if (!result.deletedCount)
    return res.status(404).json({ message: "Notification not found." });
  res.status(204).send();
}

export async function clearReadNotifications(req, res) {
  await Notification.deleteMany({ ...ownerQuery(req), isRead: true });
  res.status(204).send();
}
