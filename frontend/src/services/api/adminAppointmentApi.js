import axiosInstance from "./axiosInstance";

export const getAdminAppointments = (params) =>
  axiosInstance.get("/admin/appointments", { params });
export const getAdminAppointment = (id) =>
  axiosInstance.get(`/admin/appointments/${id}`);
export const getAvailableTherapists = (id) =>
  axiosInstance.get(`/admin/appointments/${id}/available-therapists`);
export const assignAppointmentTherapist = (id, payload) =>
  axiosInstance.patch(`/admin/appointments/${id}/assign-therapist`, payload);
export const confirmAdminAppointment = (id) =>
  axiosInstance.patch(`/admin/appointments/${id}/confirm`);
export const rescheduleAdminAppointment = (id, payload) =>
  axiosInstance.patch(`/admin/appointments/${id}/reschedule`, payload);
export const approveAdminReschedule = (id) =>
  axiosInstance.patch(`/admin/appointments/${id}/reschedule-request/approve`);
export const declineAdminReschedule = (id, payload) =>
  axiosInstance.patch(
    `/admin/appointments/${id}/reschedule-request/decline`,
    payload,
  );
export const cancelAdminAppointment = (id, payload) =>
  axiosInstance.patch(`/admin/appointments/${id}/cancel`, payload);
export const completeAdminAppointment = (id) =>
  axiosInstance.patch(`/admin/appointments/${id}/complete`);
export const noShowAdminAppointment = (id) =>
  axiosInstance.patch(`/admin/appointments/${id}/no-show`);
