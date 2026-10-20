import { authenticate } from "./authApi";

const staffDashboardPaths = {
  admin: "/staff/admin",
  secretary: "/staff/secretary",
  therapist: "/staff/therapist",
};

export const authenticateStaff = (payload) => authenticate("login", payload);

export const getStaffDashboardPath = (role) =>
  staffDashboardPaths[role] || null;
