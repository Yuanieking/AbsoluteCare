export const API_V1_PREFIX = "/api/v1";

export function apiLink(path, method = "GET") {
  const normalized = path.startsWith(API_V1_PREFIX)
    ? path
    : `${API_V1_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
  return { href: normalized, method };
}

export function roleHomeRoute(role) {
  switch (role) {
    case "admin":
      return "/staff/admin";
    case "secretary":
      return "/staff/secretary";
    case "therapist":
      return "/staff/therapist";
    default:
      return "/dashboard";
  }
}

export function authLinks(user) {
  return {
    self: apiLink("/auth/me", "GET"),
    logout: apiLink("/auth/logout", "POST"),
    profile: apiLink("/auth/profile", "PATCH"),
    dashboard: { href: roleHomeRoute(user?.role), method: "GET" },
  };
}

export function prefersJson(req) {
  if (typeof req?.accepts === "function") {
    return req.accepts(["html", "json"]) === "json";
  }
  return /application\/json/i.test(req?.headers?.accept || "");
}
