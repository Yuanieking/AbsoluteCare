import { useEffect, useRef, useState } from "react";
import axiosInstance from "../services/api/axiosInstance";
import {
  setAuthenticatedUser,
  setAuthLoading,
} from "../services/api/authSession";
import AuthContext from "./authContext";

function normalizeUser(user) {
  if (!user) return null;

  const role = user.role === "user" ? "patient" : user.role;
  return {
    ...user,
    id: user.id || user._id || user.userId,
    firstName: user.firstName || user.firstname || "",
    lastName: user.lastName || user.lastname || "",
    role,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadingStartedAt = useRef(0);

  function setAuthUser(nextUser) {
    const normalizedUser = normalizeUser(nextUser);
    setAuthenticatedUser(normalizedUser);
    setUser(normalizedUser);
  }

  async function refreshUser() {
    setLoading(true);
    setAuthLoading(true);
    loadingStartedAt.current = Date.now();
    try {
      const response = await axiosInstance.get("/auth/me");
      const currentUser = response.data?.user || response.data;
      const nextUser = normalizeUser(currentUser);
      setAuthUser(nextUser);
      return nextUser;
    } catch (error) {
      if (error.response?.status !== 401) console.error(error);
      setAuthUser(null);
      return null;
    } finally {
      const finish = () => {
        setLoading(false);
        setAuthLoading(false);
      };
      const remaining = Math.max(
        400 - (Date.now() - loadingStartedAt.current),
        0,
      );
      window.setTimeout(finish, remaining);
    }
  }

  async function logout() {
    try {
      await axiosInstance.post("/auth/logout");
    } catch (error) {
      if (error.response?.status !== 401) console.error(error);
    } finally {
      setAuthUser(null);
    }
  }

  useEffect(() => {
    const request = window.setTimeout(() => refreshUser(), 0);
    return () => window.clearTimeout(request);
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setAuthUser(null);
    }

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, setUser: setAuthUser, refreshUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
