import axios from "axios";
import { showError } from "../../utils/toast";
import {
  canHandleSessionExpiry,
  markSessionExpiryHandled,
} from "./authSession";

const sessionCheckPaths = [
  "/auth/me",
  "/auth/login",
  "/auth/staff/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/change-password",
  "/auth/logout",
  "/settings/public",
];

function isAuthRequest(url = "") {
  const path = url.split("?")[0];
  return sessionCheckPaths.includes(path) || path.startsWith("/auth/google");
}

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !isAuthRequest(error.config?.url) &&
      canHandleSessionExpiry()
    ) {
      markSessionExpiryHandled();
      showError("Your session has expired. Please log in again.", {
        id: "session-expired",
      });
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
