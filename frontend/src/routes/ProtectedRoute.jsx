import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import AppLoader from "../components/loading/AppLoader";

function getDashboardPath(user) {
  if (user?.role === "patient") return "/dashboard";
  if (user?.role === "admin") return "/staff/admin";
  if (user?.role === "therapist") return "/staff/therapist";
  if (user?.role === "secretary") return "/staff/secretary";
  return "/";
}

function getLoginPath(location) {
  return location.pathname.startsWith("/staff") ? "/staff/login" : "/login";
}

export function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <AppLoader
        caption={
          location.pathname.startsWith("/staff")
            ? "Loading staff portal..."
            : undefined
        }
      />
    );

  if (!user) {
    return (
      <Navigate
        replace
        to={getLoginPath(location)}
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  if (
    user.mustChangePassword &&
    location.pathname !== "/staff/change-password"
  ) {
    return <Navigate replace to="/staff/change-password" />;
  }

  // Frontend guards improve UX; the backend must verify roles on every protected API endpoint.
  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate replace to={getDashboardPath(user)} />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppLoader />;
  if (!user) return <Outlet />;

  const requestedPath = location.state?.from;
  const destination =
    typeof requestedPath === "string" && requestedPath.startsWith("/")
      ? requestedPath
      : getDashboardPath(user);

  return <Navigate replace to={destination} />;
}
