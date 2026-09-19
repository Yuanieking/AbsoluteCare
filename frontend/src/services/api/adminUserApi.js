import axiosInstance from "./axiosInstance";

export const getAdminUsers = (params) =>
  axiosInstance.get("/admin/users", { params });
export const getAdminUser = (id) => axiosInstance.get(`/admin/users/${id}`);
export const createAdminUser = (payload) =>
  axiosInstance.post("/admin/users", payload);
export const updateAdminUser = (id, payload) =>
  axiosInstance.patch(`/admin/users/${id}`, payload);
export const archiveAdminUser = (id) =>
  axiosInstance.patch(`/admin/users/${id}/archive`);
export const activateAdminUser = (id) =>
  axiosInstance.patch(`/admin/users/${id}/activate`);
export const deactivateAdminUser = (id) =>
  axiosInstance.patch(`/admin/users/${id}/deactivate`);
export const removeAdminUser = (id, confirmName) =>
  axiosInstance.delete(`/admin/users/${id}`, { data: { confirmName } });
export const getAdminPatient = (id) =>
  axiosInstance.get(`/admin/patients/${id}`);
export const updateAdminPatient = (id, payload) =>
  axiosInstance.patch(`/admin/patients/${id}`, payload);
export const getAdminTherapist = (id) =>
  axiosInstance.get(`/admin/therapists/${id}`);
export const updateAdminTherapist = (id, payload) =>
  axiosInstance.patch(`/admin/therapists/${id}`, payload);
export const updateAdminTherapistSpecialization = (id, payload) =>
  axiosInstance.patch(`/admin/therapists/${id}/specialization`, payload);
export const updateAdminTherapistAvailability = (id, payload) =>
  axiosInstance.patch(`/admin/therapists/${id}/working-days`, payload);
