import axiosInstance from "./axiosInstance";

export const authenticate = (mode, payload) => {
  if (mode !== "login" && mode !== "signup") {
    throw new Error(`Unsupported authentication mode: ${mode}`);
  }

  return axiosInstance.post(`/auth/${mode}`, payload);
};

export const requestPasswordReset = (email, recaptchaToken) =>
  axiosInstance.post(
    "/auth/forgot-password",
    recaptchaToken ? { email, recaptchaToken } : { email },
  );

export const resetPassword = (payload) =>
  axiosInstance.post("/auth/reset-password", payload);

export const changePassword = (payload) =>
  axiosInstance.patch("/auth/change-password", payload);

export const updateNotificationPreferences = (payload) =>
  axiosInstance.patch("/auth/notification-preferences", payload);

export const getGoogleAuthUrl = () =>
  `${axiosInstance.defaults.baseURL}/auth/google`;

export const completeGoogleSignup = (payload) =>
  axiosInstance.post("/auth/google/complete", payload);

export const getGoogleSession = (token) =>
  axiosInstance.get("/auth/google/session", {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getApiErrorMessage = (error) =>
  error.response?.data?.message ||
  error.message ||
  "Unable to complete authentication.";
