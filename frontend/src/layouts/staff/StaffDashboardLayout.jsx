import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useNavigation,
  useParams,
} from "react-router-dom";
import { ChevronDown, LogOut, Settings2, UserRound } from "lucide-react";
import Sidebar from "../../components/dashboard/Sidebar";
import { getStaffRole, getStaffRoute } from "../../config/staffDashboardConfig";
import { useSidebar } from "../../context/useSidebar";
import { useAuth } from "../../context/useAuth";
import { getTherapistAppointments } from "../../services/api/therapistApi";
import TopProgressBar from "../../components/loading/TopProgressBar";
import NotificationBell from "../../components/notifications/NotificationBell";

function getBreadcrumbTitle(pathname, roleConfig, role) {
  const basePath = `/staff/${role}`;
  const normalized = pathname.replace(/\/+$/, "");
  if (normalized === basePath || normalized === `${basePath}/dashboard`) {
    return "Dashboard";
  }
  if (normalized.includes("/appointments/")) {
    return "Appointment details";
  }
  if (roleConfig?.navigation) {
    for (const [label, key] of roleConfig.navigation) {
      const route = getStaffRoute(role, key).replace(/\/+$/, "");
      if (normalized === route) {
        return label;
      }
    }
  }
  return roleConfig?.label || "Dashboard";
}

function StaffDashboardLayout({ role: routeRole }) {
  const { role: paramRole } = useParams();
  const { user, loading: authLoading, logout } = useAuth();
  const role = user?.role || routeRole || paramRole;
  const roleConfig = getStaffRole(role);
  const { collapsed, sidebarWidth, sidebarInset, sidebarOffset } = useSidebar();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentTime] = useState(() => Date.now());
  const profileMenuRef = useRef(null);
  const [assignedAppointmentsState, setAssignedAppointments] = useState(
    role === "therapist" && user?.id ? null : [],
  );

  useEffect(() => {
    if (role !== "therapist" || !user?.id) return;
    getTherapistAppointments()
      .then((response) =>
        setAssignedAppointments(response.data.appointments || []),
      )
      .catch(() => setAssignedAppointments([]));
  }, [role, user?.id]);

  const assignedAppointments = useMemo(
    () => assignedAppointmentsState || [],
    [assignedAppointmentsState],
  );
  const appointmentsLoading =
    role === "therapist" && assignedAppointmentsState === null;

  const activeUpcomingAppointments = useMemo(() => {
    return assignedAppointments.filter((item) => {
      const status = item.status?.toLowerCase?.() || "";
      return (
        status === "confirmed" &&
        item.scheduledStart &&
        new Date(item.scheduledStart).getTime() >= currentTime
      );
    });
  }, [assignedAppointments, currentTime]);

  const breadcrumbTitle = useMemo(
    () => getBreadcrumbTitle(location.pathname, roleConfig, role),
    [location.pathname, roleConfig, role],
  );

  const firstName = user?.firstName || user?.firstname || "";
  const lastName = user?.lastName || user?.lastname || "";
  const displayName = `${firstName} ${lastName}`.trim();
  const initials =
    `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() || "…";

  useEffect(() => {
    if (!profileOpen) return;
    function moveProfileFocus(event) {
      if (
        !profileMenuRef.current ||
        !["ArrowDown", "ArrowUp"].includes(event.key)
      )
        return;
      const items = [...profileMenuRef.current.querySelectorAll("a, button")];
      const currentIndex = items.indexOf(document.activeElement);
      const nextIndex =
        event.key === "ArrowDown"
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
      event.preventDefault();
      items[nextIndex]?.focus();
    }
    document.addEventListener("keydown", moveProfileFocus);
    return () => document.removeEventListener("keydown", moveProfileFocus);
  }, [profileOpen]);

  async function logOut() {
    await logout();
    navigate("/staff/login");
  }

  return (
    <div
      className={`staff-dashboard-shell${collapsed ? " is-sidebar-collapsed" : ""}`}
      style={{
        "--sidebar-width": sidebarWidth,
        "--sidebar-inset": sidebarInset,
        "--sidebar-offset": sidebarOffset,
      }}
    >
      <TopProgressBar
        active={
          authLoading || appointmentsLoading || navigation.state !== "idle"
        }
      />
      <Sidebar
        role={user?.role || role}
        badgeCounts={
          appointmentsLoading
            ? {}
            : { appointments: activeUpcomingAppointments.length }
        }
        onLogout={logOut}
      />
      <div className="staff-dashboard-main">
        <header className="staff-dashboard-topbar">
          <div className="staff-topbar-title">
            <span>Staff portal</span>
            <b>/</b>
            <strong>{breadcrumbTitle}</strong>
            <span className="staff-role-badge">{roleConfig.label}</span>
          </div>

          <div className="staff-topbar-actions">
            <NotificationBell role={role} />
            <div className="staff-topbar-popover-wrap">
              <button
                className="staff-profile-trigger"
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
              >
                <span className="staff-avatar">
                  {user?.profilePicture ? (
                    <img src={user.profilePicture} alt="" />
                  ) : authLoading ? (
                    <span
                      className="staff-avatar-skeleton"
                      aria-hidden="true"
                    />
                  ) : (
                    initials
                  )}
                </span>
                <span>
                  {authLoading
                    ? "Loading profile"
                    : displayName || "Staff member"}
                </span>
                <ChevronDown size={14} />
              </button>
              {profileOpen && (
                <div
                  className="staff-popover staff-profile-menu"
                  ref={profileMenuRef}
                >
                  <Link to={getStaffRoute(role, "profile")}>
                    <UserRound size={14} />
                    View profile
                  </Link>
                  <Link to={getStaffRoute(role, "profile")}>
                    <Settings2 size={14} />
                    Edit profile
                  </Link>
                  <button type="button" onClick={logOut}>
                    <LogOut size={14} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <Outlet
          context={{
            role,
            roleConfig,
            assignedAppointments,
            activeUpcomingAppointments,
            appointmentsLoading,
          }}
        />
      </div>
    </div>
  );
}

export default StaffDashboardLayout;
