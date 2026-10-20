import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "../services/api/authApi";
import {
  getAppointments,
  getCurrentPatient,
  getDependents,
  getSessions,
  getUnreadNotificationCount,
} from "../services/api/patientApi";
import { useAuth } from "../context/useAuth";

const initialState = {
  profile: null,
  appointments: [],
  sessionHistory: [],
  dependents: [],
  upcomingAppointment: null,
  sessionsCompleted: 0,
  treatmentPlan: null,
  announcement: null,
  pendingCount: 0,
  unreadNotificationCount: 0,
};

function normalizeProfile(user) {
  if (!user) return null;

  const firstName = user.firstname || user.firstName || "";
  const lastName = user.lastname || user.lastName || "";
  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();

  return {
    ...user,
    firstName,
    lastName,
    initials: initials || "AC",
  };
}

function dependentAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return "Age unavailable";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return `${Math.max(age, 0)} ${age === 1 ? "year" : "years"}`;
}

function normalizeDependent(dependent) {
  const name =
    `${dependent.firstName || ""} ${dependent.lastName || ""}`.trim();
  const initials =
    `${dependent.firstName?.[0] || ""}${dependent.lastName?.[0] || ""}`.toUpperCase();
  const nextAppointment = dependent.nextAppointment;

  return {
    ...dependent,
    name,
    initials: initials || "D",
    age: dependentAge(dependent.dateOfBirth),
    service: nextAppointment?.service?.name || "No appointment yet",
    progress: dependent.relationship || "Dependent",
    nextVisit: nextAppointment?.scheduledStart
      ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(
          new Date(nextAppointment.scheduledStart),
        )
      : "Not scheduled",
  };
}

export function usePatientDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestProfile = useCallback(async () => {
    const response = await getCurrentPatient();
    return normalizeProfile(response.data?.user || response.data);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      const [
        profile,
        dependentsResponse,
        pendingResponse,
        upcomingResponse,
        sessionsResponse,
        unreadResponse,
      ] = await Promise.all([
        requestProfile(),
        getDependents(),
        getAppointments("pending"),
        getAppointments("upcoming"),
        getSessions(),
        getUnreadNotificationCount(),
      ]);
      const appointments = upcomingResponse.data?.appointments || [];
      const sessionHistory = sessionsResponse.data?.sessions || [];
      setState((currentState) => ({
        ...currentState,
        profile,
        dependents: (dependentsResponse.data?.dependents || []).map(
          normalizeDependent,
        ),
        appointments,
        sessionHistory,
        upcomingAppointment: appointments[0] || null,
        sessionsCompleted: sessionHistory.length,
        pendingCount: pendingResponse.data?.total || 0,
        unreadNotificationCount: unreadResponse.data?.count || 0,
      }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [requestProfile, user]);

  useEffect(() => {
    if (!user) return undefined;

    let active = true;

    Promise.all([
      requestProfile(),
      getDependents(),
      getAppointments("pending"),
      getAppointments("upcoming"),
      getSessions(),
      getUnreadNotificationCount(),
    ])
      .then(
        ([
          profile,
          dependentsResponse,
          pendingResponse,
          upcomingResponse,
          sessionsResponse,
          unreadResponse,
        ]) => {
          if (!active) return;
          const appointments = upcomingResponse.data?.appointments || [];
          const sessionHistory = sessionsResponse.data?.sessions || [];
          setState((currentState) => ({
            ...currentState,
            profile,
            dependents: (dependentsResponse.data?.dependents || []).map(
              normalizeDependent,
            ),
            appointments,
            sessionHistory,
            upcomingAppointment: appointments[0] || null,
            sessionsCompleted: sessionHistory.length,
            pendingCount: pendingResponse.data?.total || 0,
            unreadNotificationCount: unreadResponse.data?.count || 0,
          }));
        },
      )
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [requestProfile, user]);

  return { ...state, loading, error, retry: loadDashboard };
}
