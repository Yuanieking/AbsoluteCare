import {
  Activity,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  CircleDollarSign,
  LayoutDashboard,
  Stethoscope,
  Settings2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { getStaffRoute, getStaffRole } from "./staffDashboardConfig";

const patientItems = [
  {
    key: "dashboard",
    label: "Dashboard",
    group: "Your care",
    icon: LayoutDashboard,
    to: "/dashboard",
    end: true,
  },
  {
    key: "appointments",
    label: "My appointments",
    group: "Your care",
    icon: CalendarDays,
    to: "/dashboard/appointments",
  },
  {
    key: "book",
    label: "Book appointment",
    group: "Your care",
    icon: CalendarPlus,
    to: "/dashboard/book",
  },
  {
    key: "progress",
    label: "Therapy progress",
    group: "Your care",
    icon: Activity,
    to: "/dashboard/progress",
  },
  {
    key: "dependents",
    label: "My dependents",
    group: "Your care",
    icon: UsersRound,
    to: "/dashboard/dependents",
  },
];

const staffIcons = {
  dashboard: LayoutDashboard,
  users: UsersRound,
  therapists: Stethoscope,
  patients: UserRound,
  appointments: CalendarDays,
  services: ClipboardList,
  payments: CircleDollarSign,
  reports: BarChart3,
  records: ClipboardList,
  availability: CalendarClock,
  profile: Settings2,
  settings: Settings2,
};

export function getSidebarConfig(role, badgeCounts = {}) {
  if (role === "patient") {
    return {
      label: "Patient",
      subtitle: "Patient portal",
      navLabel: "Your care",
      helpTitle: "Need a hand?",
      helpText: "Call 0917 715 2780",
      logoutPath: "/login",
      items: patientItems,
    };
  }

  const roleConfig = getStaffRole(role);
  const defaultGroupByKey = {
    dashboard: "Workspace",
    appointments: "Workspace",
    availability: "Workspace",
    users: "Management",
    therapists: "Management",
    patients: "Management",
    services: "Management",
    payments: "Insights",
    reports: "Insights",
    settings: "System",
    sessions: "Insights",
    records: "Insights",
  };

  const therapistGroupByKey = {
    dashboard: "Workspace",
    appointments: "Workspace",
    patients: "Workspace",
    records: "Workspace",
    availability: "Schedule",
  };

  const groupByKey =
    role === "therapist" ? therapistGroupByKey : defaultGroupByKey;

  return {
    label: roleConfig.label,
    roleLabel: `${roleConfig.label} access`,
    subtitle: "Staff portal",
    helpTitle: "Need help?",
    helpText: "Contact clinic admin",
    logoutPath: "/staff/login",
    items: roleConfig.navigation
      .map(([label, key]) => ({
        key,
        label,
        group: groupByKey[key] || "Workspace",
        icon: staffIcons[key] || CalendarCheck2,
        to: getStaffRoute(role, key),
        end: key === "dashboard",
        badge:
          Number(badgeCounts[key]) > 0 ? Number(badgeCounts[key]) : undefined,
      }))
      .filter((item) => item.key !== "profile"),
  };
}
