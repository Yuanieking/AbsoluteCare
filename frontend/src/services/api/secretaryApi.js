import axiosInstance from "./axiosInstance";

export const getSecretaryProfile = () =>
  axiosInstance.get("/secretary/profile");
export const updateSecretaryProfile = (payload) =>
  axiosInstance.patch("/secretary/profile", payload);
export const getSecretarySchedule = (params) =>
  axiosInstance.get("/secretary/schedule", { params });
export const getSecretaryAppointment = (id) =>
  axiosInstance.get(`/secretary/appointments/${id}`);
export const getSecretaryPayments = (params) =>
  axiosInstance.get("/secretary/payments", { params });
export const recordSecretaryPayment = (id, payload) =>
  axiosInstance.post(`/secretary/appointments/${id}/payment`, payload);
export const updateSecretaryPayment = (id, payload) =>
  axiosInstance.patch(`/secretary/appointments/${id}/payment`, payload);
