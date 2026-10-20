import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Eye,
  Plus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  DashboardEmptyState,
  StatCard,
  StatusBadge,
} from "../dashboard/DashboardPrimitives";
import Skeleton from "../loading/Skeleton";
import PageHeader from "../dashboard/PageHeader";
import {
  getAdminAppointments,
  confirmAdminAppointment,
} from "../../services/api/adminAppointmentApi";
import { getAdminReports } from "../../services/api/adminMonitoringApi";
import { getToastError, showError, showPromise } from "../../utils/toast";

function dayBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function monthBounds() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: now.toISOString(),
  };
}

function appointmentName(appointment) {
  return (
    `${appointment.patient?.firstname || ""} ${appointment.patient?.lastname || ""}`.trim() ||
    "Unnamed patient"
  );
}

function therapistName(appointment) {
  return appointment.therapist
    ? `${appointment.therapist.firstname || ""} ${appointment.therapist.lastname || ""}`.trim()
    : "Unassigned";
}

function appointmentDate(value) {
  if (!value) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function AdminDashboardOverview() {
  const navigate = useNavigate();
  const [state, setState] = useState({
    reports: null,
    pending: [],
    today: [],
    loading: true,
    errors: {},
  });

  function load() {
    setState((current) => ({ ...current, loading: true, errors: {} }));
    const month = monthBounds();
    const today = dayBounds();
    Promise.allSettled([
      getAdminReports(month),
      getAdminAppointments({ tab: "pending", page: 1, limit: 5 }),
      getAdminAppointments({
        tab: "upcoming",
        from: today.from,
        to: today.to,
        page: 1,
        limit: 8,
      }),
    ]).then(([reportsResult, pendingResult, todayResult]) => {
      const errors = {};
      if (reportsResult.status === "rejected")
        errors.reports = getToastError(
          reportsResult.reason,
          "Unable to load summary.",
        );
      if (pendingResult.status === "rejected")
        errors.pending = getToastError(
          pendingResult.reason,
          "Unable to load pending requests.",
        );
      if (todayResult.status === "rejected")
        errors.today = getToastError(
          todayResult.reason,
          "Unable to load today’s schedule.",
        );
      setState({
        reports:
          reportsResult.status === "fulfilled"
            ? reportsResult.value.data
            : null,
        pending:
          pendingResult.status === "fulfilled"
            ? pendingResult.value.data?.appointments || []
            : [],
        today:
          todayResult.status === "fulfilled"
            ? todayResult.value.data?.appointments || []
            : [],
        loading: false,
        errors,
      });
    });
  }

  useEffect(() => {
    const request = window.setTimeout(load, 0);
    return () => window.clearTimeout(request);
  }, []);

  if (state.loading) return <AdminDashboardSkeleton />;

  const pendingCount = state.pending.length;
  const report = state.reports;
  const unpaidCount = report?.payments?.unpaid?.count || 0;
  const workload = report?.therapistWorkload || [];
  const summary = [
    {
      label: "Pending requests",
      value: pendingCount,
      caption: "Need review",
      action: "Review requests",
      href: "/staff/admin/appointments?tab=pending",
      icon: <Clock3 size={20} />,
      variant: pendingCount ? "warning" : "default",
    },
    {
      label: "Appointments today",
      value: state.today.length,
      caption: "On today’s schedule",
      action: "View schedule",
      href: "/staff/admin/appointments?tab=upcoming",
      icon: <CalendarDays size={20} />,
    },
    {
      label: "Total patients",
      value: report?.patients?.total ?? "—",
      caption: `+${report?.patients?.new || 0} this month`,
      action: "View patients",
      href: "/staff/admin/users?role=patient",
      icon: <UsersRound size={20} />,
    },
    {
      label: "Unpaid balances",
      value: unpaidCount,
      caption: report?.payments?.unpaid?.total
        ? `₱${Number(report.payments.unpaid.total).toLocaleString("en-PH")}`
        : "All caught up",
      action: "View payments",
      href: "/staff/admin/payments?status=unpaid",
      icon: <CircleDollarSign size={20} />,
      variant: unpaidCount ? "warning" : "default",
    },
  ];

  return (
    <main className="staff-dashboard-content admin-dashboard">
      <PageHeader
        eyebrow="Admin overview"
        title="Dashboard"
        description={new Intl.DateTimeFormat("en-PH", {
          dateStyle: "full",
        }).format(new Date())}
        action={
          <Link className="staff-section-primary" to="/staff/admin/users">
            <UserPlus size={16} /> Add user
          </Link>
        }
      />
      {pendingCount > 0 && (
        <aside className="admin-attention-banner">
          <AlertCircle size={18} />
          <span>
            <strong>
              {pendingCount} appointment{" "}
              {pendingCount === 1 ? "request is" : "requests are"} waiting for
              review.
            </strong>
            <small>
              Keep the schedule moving by reviewing the newest requests.
            </small>
          </span>
          <Link to="/staff/admin/appointments?tab=pending">Review now</Link>
        </aside>
      )}
      {state.errors.reports && (
        <InlineError message={state.errors.reports} retry={load} />
      )}
      <section className="admin-summary-grid" aria-label="Admin summary">
        {summary.map((item) => (
          <StatCard
            key={item.label}
            action={item.action}
            caption={item.caption}
            className="admin-summary-card"
            href={item.href}
            icon={item.icon}
            label={item.label}
            value={item.value}
            variant={item.variant}
          />
        ))}
      </section>
      <div className="admin-main-grid">
        <div className="admin-main-column">
          <AdminSection
            title="Pending appointment requests"
            eyebrow="Needs attention"
            action="View all"
            href="/staff/admin/appointments?tab=pending"
          >
            {state.errors.pending ? (
              <InlineError message={state.errors.pending} retry={load} />
            ) : state.pending.length ? (
              <div className="admin-request-list">
                {state.pending.map((appointment) => (
                  <RequestRow
                    key={appointment._id}
                    appointment={appointment}
                    onConfirm={load}
                    onOpen={() =>
                      navigate(`/staff/admin/appointments/${appointment._id}`)
                    }
                  />
                ))}
              </div>
            ) : (
              <DashboardEmptyState
                icon={<CheckCircle2 size={22} />}
                title="No pending requests"
                message="You’re all caught up."
              />
            )}
          </AdminSection>
          <AdminSection
            title="Today’s schedule"
            eyebrow="Clinic flow"
            action="View schedule"
            href="/staff/admin/appointments?tab=upcoming"
          >
            {state.errors.today ? (
              <InlineError message={state.errors.today} retry={load} />
            ) : state.today.length ? (
              <div className="admin-schedule-list">
                {state.today.map((appointment) => (
                  <button
                    className="admin-schedule-row"
                    type="button"
                    key={appointment._id}
                    onClick={() =>
                      navigate(`/staff/admin/appointments/${appointment._id}`)
                    }
                  >
                    <strong>
                      {appointmentDate(appointment.scheduledStart)}
                    </strong>
                    <span title={appointmentName(appointment)}>
                      {appointmentName(appointment)}
                    </span>
                    <small>{therapistName(appointment)}</small>
                    <StatusBadge status={appointment.status} />
                  </button>
                ))}
              </div>
            ) : (
              <DashboardEmptyState
                icon={<CalendarDays size={22} />}
                title="No appointments today"
                message="The clinic schedule is clear."
                action={
                  <Link
                    className="dashboard-primary-button"
                    to="/staff/admin/appointments"
                  >
                    View appointments
                  </Link>
                }
              />
            )}
          </AdminSection>
        </div>
        <aside className="admin-side-column">
          <AdminSection title="Quick actions" eyebrow="Move work forward">
            <div className="admin-quick-actions">
              <Link to="/staff/admin/services">
                <Plus size={17} /> Add therapy service
              </Link>
              <Link to="/staff/admin/payments">
                <CircleDollarSign size={17} /> Record payment
              </Link>
              <Link to="/staff/admin/reports">
                <BarChart3 size={17} /> View reports
              </Link>
            </div>
          </AdminSection>
          <AdminSection
            title="Therapist workload"
            eyebrow="This month"
            action="View reports"
            href="/staff/admin/reports"
          >
            {workload.length ? (
              <div className="admin-workload-list">
                {workload.slice(0, 5).map((item) => (
                  <div className="admin-workload-row" key={item._id}>
                    <span title={item.name}>{item.name}</span>
                    <div>
                      <i
                        style={{
                          width: `${workload[0]?.assigned ? (item.assigned / workload[0].assigned) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <strong>{item.assigned}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-muted">No assigned appointments yet.</p>
            )}
          </AdminSection>
          <AdminSection
            title="Recent activity"
            eyebrow="Latest updates"
            action="View sessions"
            href="/staff/admin/sessions"
          >
            <div className="admin-activity-list">
              {state.today.slice(0, 5).map((appointment) => (
                <Link
                  to={`/staff/admin/appointments/${appointment._id}`}
                  key={appointment._id}
                >
                  <Eye size={15} />
                  <span>
                    <strong>{appointmentName(appointment)}</strong>
                    <small>
                      {appointment.service?.name ||
                        appointment.serviceSnapshot?.name ||
                        "Therapy appointment"}
                    </small>
                  </span>
                  <time>{appointmentDate(appointment.scheduledStart)}</time>
                </Link>
              ))}
              {!state.today.length && (
                <p className="admin-muted">No recent activity.</p>
              )}
            </div>
          </AdminSection>
        </aside>
      </div>
    </main>
  );
}

function RequestRow({ appointment, onConfirm, onOpen }) {
  const [confirming, setConfirming] = useState(false);
  async function confirm(event) {
    event.stopPropagation();
    setConfirming(true);
    const request = confirmAdminAppointment(appointment._id);
    showPromise(request, {
      loading: "Confirming appointment...",
      success: "Appointment confirmed.",
      error: "Couldn’t confirm appointment.",
    });
    try {
      await request;
      onConfirm();
    } catch (error) {
      showError(getToastError(error, "Couldn’t confirm appointment."));
    } finally {
      setConfirming(false);
    }
  }
  return (
    <article
      className="admin-request-row"
      tabIndex="0"
      role="button"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <div>
        <strong title={appointmentName(appointment)}>
          {appointmentName(appointment)}
        </strong>
        <span>
          {appointment.service?.name ||
            appointment.serviceSnapshot?.name ||
            "Therapy"}
        </span>
      </div>
      <time>
        {appointmentDate(
          appointment.requestedDate
            ? `${appointment.requestedDate}T${appointment.requestedTime}`
            : appointment.scheduledStart,
        )}
      </time>
      <StatusBadge status={appointment.status} />
      <div className="admin-row-actions">
        <Link
          to={`/staff/admin/appointments/${appointment._id}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Eye size={15} /> Review
        </Link>
        {!appointment.therapist && (
          <Link
            to={`/staff/admin/appointments/${appointment._id}`}
            onClick={(event) => event.stopPropagation()}
          >
            Assign therapist
          </Link>
        )}
        <Button type="button" disabled={confirming} onClick={confirm}>
          {confirming ? "Confirming…" : "Confirm"}
        </Button>
      </div>
    </article>
  );
}

function AdminSection({ eyebrow, title, action, href, children }) {
  return (
    <Card className="admin-section-card">
      <div className="admin-section-heading">
        <div>
          <p className="dashboard-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {action && <Link to={href}>{action}</Link>}
      </div>
      {children}
    </Card>
  );
}

function InlineError({ message, retry }) {
  return (
    <div className="admin-inline-error" role="alert">
      <span>{message}</span>
      <Button variant="secondary" type="button" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

function AdminDashboardSkeleton() {
  return (
    <main className="staff-dashboard-content admin-dashboard" aria-busy="true">
      <div className="page-header admin-skeleton-header">
        <div>
          <Skeleton variant="text" width="120px" height="10px" />
          <Skeleton variant="heading" width="210px" height="38px" />
          <Skeleton variant="text" width="230px" height="14px" />
        </div>
        <Skeleton variant="button" width="120px" height="42px" />
      </div>
      <div className="admin-summary-grid">
        {[1, 2, 3, 4].map((item) => (
          <Card className="admin-summary-skeleton" key={item}>
            <Skeleton variant="circle" width="38px" height="38px" />
            <Skeleton variant="heading" width="60%" height="28px" />
            <Skeleton variant="text" width="75%" />
            <Skeleton variant="text" width="45%" />
          </Card>
        ))}
      </div>
      <div className="admin-main-grid">
        <Card className="admin-section-card">
          <Skeleton variant="heading" width="45%" height="24px" />
          {[1, 2, 3, 4].map((item) => (
            <Skeleton
              className="admin-row-skeleton"
              key={item}
              variant="text"
              width="100%"
              height="48px"
            />
          ))}
        </Card>
        <Card className="admin-section-card">
          <Skeleton variant="heading" width="55%" height="24px" />
          {[1, 2, 3].map((item) => (
            <Skeleton
              className="admin-row-skeleton"
              key={item}
              variant="text"
              width="100%"
              height="42px"
            />
          ))}
        </Card>
      </div>
    </main>
  );
}

export default AdminDashboardOverview;
