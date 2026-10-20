import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardPenLine,
  UsersRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../../../components/dashboard/PageHeader";
import {
  DashboardEmptyState,
  StatCard,
  StatusBadge,
} from "../../../components/dashboard/DashboardPrimitives";
import {
  InlineErrorCard,
  StaffDashboardSkeleton,
} from "../../../components/dashboard/Skeleton";
import { TableActionLink } from "../../../components/dashboard/TablePrimitives";
import {
  getTherapistAppointments,
  getTherapistPatients,
  getTherapistSessions,
} from "../../../services/api/therapistApi";
import {
  formatDateManila,
  formatRequestedDateTimeManila,
  formatTimeManila,
} from "../../../utils/patientFormatters";

function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    appointments: [],
    patients: [],
    sessions: [],
  });

  const [todayManilaDateString] = useState(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  });

  function reloadDashboard() {
    setLoading(true);
    setError(null);
    Promise.all([
      getTherapistAppointments(),
      getTherapistPatients(),
      getTherapistSessions(),
    ])
      .then(([appointmentsRes, patientsRes, sessionsRes]) => {
        setData({
          appointments: appointmentsRes.data?.appointments || [],
          patients: patientsRes.data?.patients || [],
          sessions: sessionsRes.data?.sessions || [],
        });
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message || "Failed to load dashboard data.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([
      getTherapistAppointments(),
      getTherapistPatients(),
      getTherapistSessions(),
    ])
      .then(([appointmentsRes, patientsRes, sessionsRes]) => {
        if (ignore) return;
        setData({
          appointments: appointmentsRes.data?.appointments || [],
          patients: patientsRes.data?.patients || [],
          sessions: sessionsRes.data?.sessions || [],
        });
      })
      .catch((err) => {
        if (ignore) return;
        setError(
          err?.response?.data?.message || "Failed to load dashboard data.",
        );
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return <StaffDashboardSkeleton />;
  }

  const todaysAppointments = data.appointments
    .filter((item) => {
      if (!item.scheduledStart)
        return item.requestedDate === todayManilaDateString;
      const itemDateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(item.scheduledStart));
      return itemDateStr === todayManilaDateString;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledStart || 0) - new Date(b.scheduledStart || 0),
    );

  const now = new Date();

  // Find next visit today
  const nextVisit =
    todaysAppointments.find(
      (item) =>
        item.status === "confirmed" &&
        item.scheduledStart &&
        new Date(item.scheduledStart) >= now,
    ) ||
    todaysAppointments.find(
      (item) => item.status === "confirmed" || item.status === "pending",
    );

  let todayCaption = "No visits today";
  if (nextVisit?.scheduledStart) {
    const timeStr = formatTimeManila(nextVisit.scheduledStart);
    const pFirst =
      nextVisit.patient?.firstname || nextVisit.patient?.firstName || "";
    const pLast =
      nextVisit.patient?.lastname || nextVisit.patient?.lastName || "";
    const patientName = `${pFirst} ${pLast}`.trim() || "Patient";
    todayCaption = `Next: ${timeStr} · ${patientName}`;
  } else if (todaysAppointments.length > 0) {
    todayCaption = `${todaysAppointments.length} visit${todaysAppointments.length === 1 ? "" : "s"} scheduled`;
  }

  const upcomingVisits = data.appointments.filter(
    (item) =>
      item.status === "confirmed" &&
      (!item.scheduledStart || new Date(item.scheduledStart) >= now),
  );

  const pendingRecords = data.appointments.filter(
    (item) =>
      item.status === "confirmed" &&
      item.scheduledStart &&
      new Date(item.scheduledStart) < now,
  ).length;

  const todayEyebrowDate = formatDateManila(new Date());

  return (
    <main className="staff-dashboard-content">
      {error && <InlineErrorCard message={error} onRetry={reloadDashboard} />}

      <PageHeader
        eyebrow="THERAPIST WORKSPACE"
        title="Your care desk"
        description="See your schedule, caseload, and session records in one place."
      />

      <section className="summary-grid" aria-label="Therapist summary">
        <StatCard
          label="Today's appointments"
          value={todaysAppointments.length}
          caption={todayCaption}
          icon={<CalendarDays size={18} />}
          action="Open schedule"
          href="/staff/therapist/my-appointments?tab=upcoming&range=today"
        />
        <StatCard
          label="Upcoming appointments"
          value={upcomingVisits.length}
          caption="Confirmed visits"
          icon={<CalendarDays size={18} />}
          action="View appointments"
          href="/staff/therapist/my-appointments?tab=upcoming"
        />
        <StatCard
          label="Assigned patients"
          value={data.patients.length}
          caption="Your caseload"
          icon={<UsersRound size={18} />}
          action="View patients"
          href="/staff/therapist/my-patients"
        />
        <StatCard
          label="Records to complete"
          value={pendingRecords}
          caption="Visits needing your notes"
          icon={<ClipboardPenLine size={18} />}
          action="Record sessions"
          variant={pendingRecords > 0 ? "warm" : "default"}
          className={pendingRecords > 0 ? "stat-card-warm" : ""}
          href="/staff/therapist/session-records"
        />
      </section>

      <section className="dashboard-card staff-schedule-card">
        <div className="staff-schedule-header">
          <div>
            <p className="dashboard-eyebrow">{todayEyebrowDate}</p>
            <h2>Today's schedule</h2>
            <p>The visits assigned to your care today.</p>
          </div>
          <Link
            className="staff-schedule-header-link"
            to="/staff/therapist/my-appointments"
          >
            <span>View all</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {todaysAppointments.length > 0 ? (
          <div className="staff-schedule-list">
            {todaysAppointments.map((item) => {
              const isNext = item._id === nextVisit?._id;
              const timeStr = item.scheduledStart
                ? formatTimeManila(item.scheduledStart)
                : formatRequestedDateTimeManila(
                    item.requestedDate,
                    item.requestedTime,
                  );
              const patientName =
                `${item.patient?.firstname || item.patient?.firstName || ""} ${item.patient?.lastname || item.patient?.lastName || ""}`.trim() ||
                "Patient";
              const serviceName =
                item.service?.name || "Physical Therapy Session";
              const isPast =
                item.status === "confirmed" &&
                item.scheduledStart &&
                new Date(item.scheduledStart) < now;

              return (
                <div
                  key={item._id}
                  className={`therapist-schedule-row${isNext ? " is-next" : ""}`}
                  onClick={() =>
                    navigate(`/staff/therapist/appointments/${item._id}`)
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/staff/therapist/appointments/${item._id}`);
                    }
                  }}
                >
                  <div className="therapist-schedule-time">
                    <span>{timeStr}</span>
                    {isNext && <span className="next-visit-pill">Next</span>}
                  </div>
                  <div className="therapist-schedule-patient">
                    <strong>{patientName}</strong>
                    <small>{serviceName}</small>
                  </div>
                  <StatusBadge status={item.status} />
                  <div className="therapist-schedule-actions">
                    <TableActionLink
                      to={`/staff/therapist/appointments/${item._id}`}
                    >
                      {isPast ? "Record session" : "View"}
                    </TableActionLink>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <DashboardEmptyState
            icon={<CalendarDays size={24} />}
            title="No appointments today"
            message="Your next confirmed visit will appear here."
            action={
              <Link
                className="dashboard-primary-button"
                to="/staff/therapist/my-appointments?tab=upcoming"
              >
                View upcoming appointments
              </Link>
            }
          />
        )}

        <span className="staff-tz-note">All times in Asia/Manila</span>
      </section>
    </main>
  );
}

export default DashboardPage;
