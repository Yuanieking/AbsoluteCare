export const staffRoles = {
  admin: {
    label: "Admin",
    title: "Clinic overview",
    description: "Keep the whole care operation moving with one clear view.",
    navigation: [
      ["Dashboard", "dashboard"],
      ["User management", "users"],
      ["Therapists", "therapists"],
      ["Patients", "patients"],
      ["Appointments", "appointments"],
      ["Therapy services", "services"],
      ["Session history", "sessions"],
      ["Payments", "payments"],
      ["Reports", "reports"],
      ["Settings", "settings"],
      ["Profile", "profile"],
    ],
    summaries: [
      ["Registered patients", "—", "A-040"],
      ["Appointments this week", "—", "A-028"],
      ["Requests to review", "—", "A-020 / A-021"],
      ["Unpaid balances", "—", "A-035"],
    ],
  },
  therapist: {
    label: "Therapist",
    title: "Your care desk",
    description:
      "See your schedule, caseload, and session records in one place.",
    navigation: [
      ["Dashboard", "dashboard"],
      ["My appointments", "appointments"],
      ["My patients", "patients"],
      ["Session records", "records"],
      ["Availability", "availability"],
    ],
    summaries: [
      ["Today's appointments", "—", "TH-008"],
      ["Upcoming appointments", "—", "TH-009"],
      ["Assigned patients", "—", "TH-011"],
      ["Records to complete", "—", "TH-018"],
    ],
  },
  secretary: {
    label: "Secretary",
    title: "Clinic schedule",
    description: "Keep appointments and payments accurate for every visit.",
    navigation: [
      ["Dashboard", "dashboard"],
      ["Appointment schedule", "appointments"],
      ["Payments", "payments"],
      ["Profile", "profile"],
    ],
    summaries: [
      ["Today's appointments", "—", "SE-005"],
      ["Unpaid appointments", "—", "SE-008"],
    ],
  },
};

export const getStaffRole = (role) => staffRoles[role] || staffRoles.secretary;

const staffRouteSegments = {
  admin: {
    dashboard: "",
    users: "users",
    therapists: "therapists",
    patients: "patients",
    appointments: "appointments",
    services: "services",
    sessions: "sessions",
    payments: "payments",
    reports: "reports",
    settings: "settings",
    profile: "profile",
  },
  therapist: {
    dashboard: "",
    appointments: "my-appointments",
    patients: "my-patients",
    records: "session-records",
    availability: "availability",
    profile: "profile",
  },
  secretary: {
    dashboard: "",
    appointments: "schedule",
    payments: "payments",
    profile: "profile",
  },
};

export const getStaffRoute = (role, key) => {
  const segment = staffRouteSegments[role]?.[key];
  return segment ? `/staff/${role}/${segment}` : `/staff/${role}`;
};
