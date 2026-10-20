import axiosInstance from "./axiosInstance";

export const getAdminServices = () => axiosInstance.get("/admin/services");
export const createAdminService = (payload) =>
  axiosInstance.post("/admin/services", payload);
export const updateAdminService = (id, payload) =>
  axiosInstance.patch(`/admin/services/${id}`, payload);
export const removeAdminService = (id) =>
  axiosInstance.delete(`/admin/services/${id}`);
