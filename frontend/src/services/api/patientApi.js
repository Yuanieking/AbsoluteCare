import axiosInstance from "./axiosInstance";

export const getCurrentPatient = () => axiosInstance.get("/auth/me");

export const updatePatientProfile = (profile) =>
  axiosInstance.patch("/auth/profile", profile);

export const getServices = () => axiosInstance.get("/services");
export const getDependents = () => axiosInstance.get("/dependents");
export const createDependent = (payload) =>
  axiosInstance.post("/dependents", payload);
export const getDependent = (id) => axiosInstance.get(`/dependents/${id}`);
export const updateDependent = (id, payload) =>
  axiosInstance.patch(`/dependents/${id}`, payload);
export const removeDependent = (id) =>
  axiosInstance.delete(`/dependents/${id}`);
export const requestAppointment = (payload) =>
  axiosInstance.post("/appointments", payload);
export const getAppointments = (status, page = 1) =>
  axiosInstance.get("/appointments", { params: { status, page } });
export const getAppointment = (id) => axiosInstance.get(`/appointments/${id}`);
export const requestReschedule = (id, payload) =>
  axiosInstance.post(`/appointments/${id}/reschedule-request`, payload);
export const cancelAppointment = (id, reason) =>
  axiosInstance.post(`/appointments/${id}/cancel`, { reason });
export const syncAppointmentCalendar = (id) =>
  axiosInstance.post(`/appointments/${id}/calendar-sync`);
export const getSessions = () => axiosInstance.get("/sessions");
export const getSession = (id) => axiosInstance.get(`/sessions/${id}`);
export const getNotifications = (page = 1) =>
  axiosInstance.get("/notifications", { params: { page } });
export const getUnreadNotificationCount = () =>
  axiosInstance.get("/notifications/unread-count");
export const markNotificationRead = (id) =>
  axiosInstance.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () =>
  axiosInstance.patch("/notifications/read-all");
export const getCalendarStatus = () =>
  axiosInstance.get("/integrations/google-calendar/status");
export const disconnectCalendar = () =>
  axiosInstance.post("/integrations/google-calendar/disconnect");
export const getCalendarConnectUrl = () =>
  `${axiosInstance.defaults.baseURL}/integrations/google-calendar/connect`;
