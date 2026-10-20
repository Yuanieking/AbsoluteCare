import { useEffect, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router-dom";
import { ChevronDown, LogOut, UserRound, UserRoundCog } from "lucide-react";
import Sidebar from "../../components/dashboard/Sidebar";
import { useSidebar } from "../../context/useSidebar";
import { useAuth } from "../../context/useAuth";
import { usePatientDashboard } from "../../hooks/usePatientDashboard";
import TopProgressBar from "../../components/loading/TopProgressBar";
import NotificationBell from "../../components/notifications/NotificationBell";

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  const dashboardState = usePatientDashboard();
  const { profile } = dashboardState;
  const { user, logout } = useAuth();
  const headerProfile = user || profile;
  const headerInitials =
    `${headerProfile?.firstName?.[0] || headerProfile?.firstname?.[0] || ""}${headerProfile?.lastName?.[0] || headerProfile?.lastname?.[0] || ""}`.toUpperCase() ||
    "AC";
  const { collapsed, sidebarWidth, sidebarInset, sidebarOffset } = useSidebar();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const breadcrumbLabels = {
    "/dashboard": "Dashboard",
    "/dashboard/appointments": "My appointments",
    "/dashboard/book": "Book an appointment",
    "/dashboard/progress": "My progress",
    "/dashboard/dependents": "My dependents",
    "/dependents": "My dependents",
  };
  const breadcrumb =
    Object.entries(breadcrumbLabels)
      .sort(([firstPath], [secondPath]) => secondPath.length - firstPath.length)
      .find(([path]) => location.pathname.startsWith(path))?.[1] ||
    "Patient portal";

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function logOut() {
    await logout();
    navigate("/login");
  }

  return (
    <div
      className={`dashboard-shell${collapsed ? " is-sidebar-collapsed" : ""}`}
      style={{
        "--sidebar-width": sidebarWidth,
        "--sidebar-inset": sidebarInset,
        "--sidebar-offset": sidebarOffset,
      }}
    >
      <TopProgressBar
        active={dashboardState.loading || navigation.state !== "idle"}
      />
      <Sidebar role={user?.role} />
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-context">
            <strong>{breadcrumb}</strong>
          </div>
          <div className="topbar-actions">
            <NotificationBell role="patient" />
            <div className="profile-wrap" ref={profileMenuRef}>
              <button
                className="profile-trigger"
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
              >
                {headerProfile?.profilePicture ? (
                  <img
                    className="avatar avatar-small"
                    src={headerProfile.profilePicture}
                    alt=""
                  />
                ) : (
                  <span className="avatar avatar-small">{headerInitials}</span>
                )}
                <span className="profile-trigger-name">
                  {headerProfile?.firstName || "Patient"}
                </span>
                {headerProfile?.isGuardian && (
                  <span className="staff-status staff-status-active">
                    Guardian
                  </span>
                )}
                <ChevronDown size={15} />
              </button>
              {profileOpen && (
                <div className="popover profile-popover">
                  <Link to="/profile" onClick={() => setProfileOpen(false)}>
                    <UserRound size={15} />
                    Profile
                  </Link>
                  <Link to="/settings" onClick={() => setProfileOpen(false)}>
                    <UserRoundCog size={15} />
                    Settings
                  </Link>
                  <button type="button" onClick={logOut}>
                    <LogOut size={15} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <Outlet context={dashboardState} />
      </div>
    </div>
  );
}

export default DashboardLayout;
