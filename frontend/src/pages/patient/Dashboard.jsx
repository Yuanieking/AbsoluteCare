import { useOutletContext } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarPlus,
  ChevronRight,
  Plus,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  DashboardEmptyState,
  StatCard,
  StatusBadge,
} from "../../components/dashboard/DashboardPrimitives";
import { DashboardSkeleton } from "../../components/dashboard/Skeleton";
import { useDelayedLoading } from "../../hooks/useDelayedLoading";
import {
  appointmentDate,
  appointmentTime,
  therapistName,
} from "../../utils/patientFormatters";

function Dashboard() {
  const {
    profile,
    sessionHistory,
    upcomingAppointment,
    sessionsCompleted,
    pendingCount,
    loading,
    error,
    retry,
  } = useOutletContext();
  const showSkeleton = useDelayedLoading(loading);

  if (loading && showSkeleton) return <DashboardSkeleton />;
  if (loading) {
    return (
      <main
        className="dashboard-content dashboard-loading-region"
        aria-busy="true"
      >
        <p className="sr-only" role="status">
          Loading your dashboard
        </p>
      </main>
    );
  }
  if (error) return <DashboardState error={error} retry={retry} />;

  const firstName = profile?.firstName || "there";
  const today = new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="dashboard-content">
      <section className="dashboard-welcome">
        <div>
          <p className="dashboard-eyebrow">{today}</p>
          <h1>Welcome back, {firstName}</h1>
          <p>Here is your care plan at a glance.</p>
        </div>
        <Link className="dashboard-primary-button" to="/dashboard/book">
          <CalendarPlus size={17} aria-hidden="true" />
          Book an appointment
        </Link>
      </section>

      <section className="summary-grid" aria-label="Care summary">
        <StatCard
          icon={<CalendarCheck2 size={17} strokeWidth={1.8} />}
          label="Upcoming appointment"
          value={
            upcomingAppointment
              ? appointmentDate(upcomingAppointment)
              : "No upcoming appointments"
          }
          caption={
            upcomingAppointment
              ? `${appointmentTime(upcomingAppointment)} · ${upcomingAppointment.service?.name || "Therapy session"}`
              : "Book your next session"
          }
          action="View appointments"
          href="/dashboard/appointments"
        />
        <StatCard
          icon={<Stethoscope size={18} />}
          label="Sessions completed"
          value={sessionsCompleted}
          caption="sessions recorded"
          action="View history"
          href="/dashboard/progress"
        />
        <StatCard
          icon={<CalendarCheck2 size={17} strokeWidth={1.8} />}
          label="Pending requests"
          value={pendingCount}
          caption="awaiting confirmation"
          action="Review requests"
          href="/dashboard/appointments"
        />
        <StatCard
          icon={<Plus size={17} strokeWidth={1.8} />}
          label="Next step"
          value="Book a new appointment"
          caption="Choose a service and find a time that works."
          action="Start booking"
          href="/dashboard/book"
          variant="cta"
        />
      </section>

      <ReminderBanner appointment={upcomingAppointment} />
      <HistorySection sessions={sessionHistory.slice(0, 3)} />
    </main>
  );
}

function ReminderBanner({ appointment }) {
  return (
    <aside className="dashboard-reminder" aria-label="Care reminder">
      <strong>
        {appointment ? "Your next visit is coming up" : "Keep your care moving"}
      </strong>
      <span>
        {appointment
          ? `Review ${appointment.service?.name || "your appointment"} details before ${appointmentDate(appointment)}.`
          : "Book an appointment when you are ready for your next session."}
      </span>
      <Link to={appointment ? "/dashboard/appointments" : "/dashboard/book"}>
        {appointment ? "Review appointments" : "Book a visit"}
        <ChevronRight size={15} />
      </Link>
    </aside>
  );
}

export function AppointmentsSection({ appointments }) {
  return (
    <section className="dashboard-section" id="appointments">
      <SectionHeading eyebrow="Your schedule" title="Upcoming appointments">
        <Link className="subtle-action" to="/dashboard/book">
          Book appointment <ArrowUpRight size={14} />
        </Link>
      </SectionHeading>
      {appointments.length ? (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Service</th>
                <th>Therapist</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={`${appointment.date}-${appointment.time}`}>
                  <td data-label="Date">
                    <strong>{appointment.date}</strong>
                  </td>
                  <td data-label="Time">{appointment.time}</td>
                  <td data-label="Service">
                    <span className="service-cell">
                      <span className="service-dot" />
                      {appointment.service}
                    </span>
                  </td>
                  <td data-label="Therapist">{appointment.therapist}</td>
                  <td data-label="Status">
                    <StatusBadge status={appointment.status} />
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      aria-label={`Actions for ${appointment.date}`}
                    >
                      •••
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyPanel
          icon={<CalendarCheck2 size={22} />}
          title="No upcoming appointments"
          message="When you book a visit, your appointment details will appear here."
          action="Book your next session"
          href="/dashboard/book"
        />
      )}
      <div className="table-footnote">
        <span>
          {appointments.length
            ? `Showing ${appointments.length} upcoming visit${appointments.length === 1 ? "" : "s"}`
            : "Your schedule is clear"}
        </span>
        {appointments.length > 0 && (
          <a href="#appointments">
            View all appointments <ChevronRight size={14} />
          </a>
        )}
      </div>
    </section>
  );
}

export function HistorySection({ sessions }) {
  return (
    <section className="dashboard-section history-section" id="history">
      <SectionHeading eyebrow="Keep track of your care" title="Recent activity">
        <Link
          className="icon-link"
          to="/dashboard/progress"
          aria-label="View all recent activity"
        >
          <ArrowUpRight size={17} />
        </Link>
      </SectionHeading>
      {sessions.length ? (
        <div className="history-list">
          {sessions.map((session) => (
            <article className="history-item" key={session._id || session.date}>
              <span className="history-marker">
                <CalendarCheck2 size={14} />
              </span>
              <div>
                <strong>{session.sessionDate || session.date}</strong>
                <span>
                  {session.service?.name ||
                    session.service ||
                    "Therapy session"}{" "}
                  <i />{" "}
                  {therapistName(session.therapist || session.therapistName)}
                </span>
                <p>
                  {session.patientVisibleNotes ||
                    session.note ||
                    "Session completed."}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyPanel
          icon={<Stethoscope size={22} />}
          title="No session history yet"
          message="Completed visits and therapist notes will appear here."
        />
      )}
    </section>
  );
}

export function DependentsSection({ dependents }) {
  return (
    <section className="dashboard-section dependents-section" id="dependents">
      <SectionHeading eyebrow="For your family" title="My dependents">
        <button className="icon-link" type="button" aria-label="Add dependent">
          <Plus size={17} />
        </button>
      </SectionHeading>
      {dependents.length ? (
        <div className="dependents-list">
          {dependents.map((dependent) => (
            <article className="dependent" key={dependent.name}>
              <span className="avatar dependent-avatar">
                {dependent.initials}
              </span>
              <div className="dependent-main">
                <strong>{dependent.name}</strong>
                <span>
                  {dependent.age} · {dependent.service}
                </span>
                <small>
                  <span className="dependent-status" />
                  {dependent.progress}
                </small>
              </div>
              <div className="dependent-next">
                <span>Next visit</span>
                <strong>{dependent.nextVisit}</strong>
              </div>
              <ChevronRight size={16} className="dependent-arrow" />
            </article>
          ))}
        </div>
      ) : (
        <EmptyPanel
          icon={<Plus size={22} />}
          title="No dependents added"
          message="Add a child profile when you manage pediatric OT care for your family."
          action="Add a dependent"
        />
      )}
    </section>
  );
}

export function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="section-title-row">
      <div>
        <p className="dashboard-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function EmptyPanel({ icon, title, message, action, href }) {
  return (
    <DashboardEmptyState
      icon={icon}
      title={title}
      message={message}
      action={
        action &&
        (href ? (
          <a className="empty-action" href={href}>
            {action} <ArrowUpRight size={14} />
          </a>
        ) : (
          <button className="empty-action" type="button">
            {action}
          </button>
        ))
      }
    />
  );
}

function DashboardState({ message, error, retry }) {
  return (
    <main className="dashboard-content dashboard-state">
      <div className="dashboard-state-card">
        {error ? (
          <>
            <span className="empty-icon">
              <RefreshCw size={22} />
            </span>
            <h1>We couldn’t load your dashboard</h1>
            <p>{error}</p>
            <button
              className="dashboard-primary-button"
              type="button"
              onClick={retry}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <span className="dashboard-state-loader" />
            <h1>{message}</h1>
          </>
        )}
      </div>
    </main>
  );
}

export default Dashboard;
