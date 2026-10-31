import { Router } from "express";
import {
  clearReadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  unreadNotificationCount,
} from "../controller/notificationController.js";
import { protectRoute } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protectRoute);
router.get("/", listNotifications);
router.get("/unread-count", unreadNotificationCount);
router.patch("/read-all", markAllNotificationsRead);
router.delete("/", clearReadNotifications);
router.patch("/:id/read", markNotificationRead);
router.patch("/:id/unread", markNotificationUnread);
router.delete("/:id", deleteNotification);

export default router;
