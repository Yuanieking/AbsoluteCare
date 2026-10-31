import axiosInstance from "./axiosInstance";

export const getTherapistProfile = () =>
  axiosInstance.get("/therapist/profile");
export const updateTherapistProfile = (payload) =>
  axiosInstance.patch("/therapist/profile", payload);
export const updateAvailability = (payload) =>
  axiosInstance.patch("/therapist/availability", payload);
export const getTherapistAppointments = (status) =>
  axiosInstance.get("/therapist/appointments", {
    params: status ? { status } : {},
  });
export const getTherapistAppointment = (id) =>
  axiosInstance.get(`/therapist/appointments/${id}`);
export const requestTherapistReschedule = (id, payload) =>
  axiosInstance.post(
    `/therapist/appointments/${id}/reschedule-request`,
    payload,
  );
export const markAppointmentNoShow = (id) =>
  axiosInstance.patch(`/therapist/appointments/${id}/no-show`);
export const createTherapySession = (id, payload) =>
  axiosInstance.post(`/therapist/appointments/${id}/session`, payload);
export const getTherapistPatients = () =>
  axiosInstance.get("/therapist/patients");
export const getTherapistSessions = (params) =>
  axiosInstance.get("/therapist/sessions", { params });
export const getTherapistSession = (id) =>
  axiosInstance.get(`/therapist/sessions/${id}`);
export const updateTherapySession = (id, payload) =>
  axiosInstance.patch(`/therapist/sessions/${id}`, payload);
export const getTherapistCalendarStatus = () =>
  axiosInstance.get("/integrations/google-calendar/therapist-status");
export const disconnectTherapistCalendar = () =>
  axiosInstance.post("/integrations/google-calendar/therapist-disconnect");
export const getTherapistCalendarConnectUrl = () =>
  `${axiosInstance.defaults.baseURL}/integrations/google-calendar/therapist-connect`;
