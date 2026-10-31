import axiosInstance from "./axiosInstance";

export const getNotifications = (params = {}) =>
  axiosInstance.get("/notifications", { params });
export const getUnreadNotificationCount = () =>
  axiosInstance.get("/notifications/unread-count");
export const markNotificationRead = (id) =>
  axiosInstance.patch(`/notifications/${id}/read`);
export const markNotificationUnread = (id) =>
  axiosInstance.patch(`/notifications/${id}/unread`);
export const markAllNotificationsRead = () =>
  axiosInstance.patch("/notifications/read-all");
export const deleteNotification = (id) =>
  axiosInstance.delete(`/notifications/${id}`);
export const clearReadNotifications = () =>
  axiosInstance.delete("/notifications");
