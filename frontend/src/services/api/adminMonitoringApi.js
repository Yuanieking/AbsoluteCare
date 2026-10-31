import axiosInstance from "./axiosInstance";

export const completeAdminAppointment = (id) =>
  axiosInstance.patch(`/admin/appointments/${id}/complete`);
export const noShowAdminAppointment = (id) =>
  axiosInstance.patch(`/admin/appointments/${id}/no-show`);
export const getAdminSessions = (params) =>
  axiosInstance.get("/admin/sessions", { params });
export const getAdminPayments = (params) =>
  axiosInstance.get("/admin/payments", { params });
export const getAdminReports = (params) =>
  axiosInstance.get("/admin/reports", { params });
export const recordAdminPayment = (id, payload) =>
  axiosInstance.post(`/admin/appointments/${id}/payment`, payload);
export const updateAdminPayment = (id, payload) =>
  axiosInstance.patch(`/admin/appointments/${id}/payment`, payload);
export const exportAdminPayments = (params) =>
  axiosInstance.get("/admin/reports/payments/export", {
    params,
    responseType: "blob",
  });
