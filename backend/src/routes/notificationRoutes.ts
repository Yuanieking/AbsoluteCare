import { Router } from "express";
import {
  clearReadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  unreadNotificationCount,
} from "../controllers/notificationController.js";
import { protectRoute } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protectRoute);
router.get("/", listNotifications);
router.get("/unread-count", unreadNotificationCount);
// ** PATCH /read-all and DELETE / - bulk writes, no single record to timestamp-guard.
router.patch("/read-all", markAllNotificationsRead);
router.delete("/", clearReadNotifications);
// ** Concurrency: single-notification routes accept If-Match: "<notification.updatedAt>" -> 409 when stale.
// ** PATCH /:id/read - mark read.
router.patch("/:id/read", markNotificationRead);
// ** PATCH /:id/unread - mark unread.
router.patch("/:id/unread", markNotificationUnread);
// ** DELETE /:id - delete one notification.
router.delete("/:id", deleteNotification);

export default router;
