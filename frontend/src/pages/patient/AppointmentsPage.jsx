import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Filter, RefreshCw, X } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import {
  DashboardEmptyState,
  StatusBadge,
} from "../../components/dashboard/DashboardPrimitives";
import { getApiErrorMessage } from "../../services/api/authApi";
import {
  cancelAppointment,
  getAppointments,
  requestReschedule,
} from "../../services/api/patientApi";
import {
  appointmentDate,
  appointmentTime,
  therapistName,
  todayInManila,
} from "../../utils/patientFormatters";
import { getToastError, showPromise } from "../../utils/toast";
import { TableSkeleton } from "../../components/loading/Skeleton";

const tabs = [
  { key: "pending", label: "Pending requests" },
  { key: "upcoming", label: "Upcoming" },
  { key: "previous", label: "Previous" },
];

function AppointmentsPage() {
  const { retry } = useOutletContext();
  const [tab, setTab] = useState("pending");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadAppointments = useCallback(
    async function loadAppointments(nextPage = 1, append = false) {
      setLoading(true);
      setError("");
      try {
        const response = await getAppointments(tab, nextPage);
        const next = response.data?.appointments || [];
        setAppointments((current) => (append ? [...current, ...next] : next));
        setPage(nextPage);
        setTotal(response.data?.total || 0);
      } catch (requestError) {
        setError(getApiErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(loadAppointments, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAppointments]);

  async function submitReschedule(event) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const request = requestReschedule(selected._id, {
      proposedDate: form.get("proposedDate"),
      proposedTime: form.get("proposedTime"),
      reason: form.get("reason"),
    });
    showPromise(request, {
      loading: "Submitting reschedule request...",
      success: "Reschedule request sent.",
      error: "Couldn't submit the reschedule request.",
    });
    try {
      await request;
      setSelected(null);
      await loadAppointments(page);
    } catch (requestError) {
      getToastError(requestError);
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id) {
    if (!window.confirm("Cancel this appointment?")) return;
    const request = cancelAppointment(id);
    showPromise(request, {
      loading: "Cancelling appointment...",
      success: "Appointment cancelled.",
      error: "Couldn't cancel the appointment.",
    });
    try {
      await request;
      await loadAppointments(page);
    } catch (requestError) {
      getToastError(requestError);
    }
  }

  return (
    <main className="dashboard-content">
      <section className="dashboard-section patient-page-section">
        <div className="section-title-row">
          <div>
            <p className="dashboard-eyebrow">Your schedule</p>
            <h1>My appointments</h1>
          </div>
          <Link className="dashboard-primary-button" to="/dashboard/book">
            Book appointment
          </Link>
        </div>
        <div
          className="patient-appointment-tabs"
          role="tablist"
          aria-label="Appointment status"
        >
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? "is-active" : ""}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="dashboard-filter-row">
          <Filter size={15} aria-hidden="true" />
          <span>
            {total} {total === 1 ? "appointment" : "appointments"}
          </span>
        </div>
        {loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : error ? (
          <PageState
            error={error}
            retry={() => {
              retry();
              loadAppointments();
            }}
          />
        ) : appointments.length ? (
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
                {appointments.map((appointment) => {
                  const rescheduleOpen =
                    appointment.rescheduleRequest?.status === "requested";
                  return (
                    <tr key={appointment._id}>
                      <td data-label="Date">
                        <strong>{appointmentDate(appointment)}</strong>
                      </td>
                      <td data-label="Time">{appointmentTime(appointment)}</td>
                      <td data-label="Service">
                        {appointment.service?.name || "Therapy session"}
                      </td>
                      <td data-label="Therapist">
                        {therapistName(appointment.therapist)}
                      </td>
                      <td data-label="Status">
                        <StatusBadge
                          status={
                            rescheduleOpen
                              ? "Reschedule requested"
                              : appointment.status
                          }
                        />
                      </td>
                      <td className="table-actions appointment-actions">
                        <Link to={`/dashboard/appointments/${appointment._id}`}>
                          View details
                        </Link>
                        {(tab === "pending" || tab === "upcoming") && (
                          <button
                            type="button"
                            disabled={rescheduleOpen}
                            onClick={() => setSelected(appointment)}
                          >
                            {rescheduleOpen ? "Requested" : "Reschedule"}
                          </button>
                        )}
                        {tab === "upcoming" && (
                          <button
                            type="button"
                            onClick={() => cancel(appointment._id)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <DashboardEmptyState
            icon={<CalendarDays size={22} />}
            title={`No ${tab === "pending" ? "pending requests" : `${tab} appointments`}`}
            message={
              tab === "previous"
                ? "Completed visits and appointment outcomes will appear here."
                : "Book a visit and your schedule will appear here."
            }
            action={
              <Link className="dashboard-primary-button" to="/dashboard/book">
                Book an appointment
              </Link>
            }
          />
        )}
        {!loading && appointments.length < total && (
          <button
            className="subtle-action"
            type="button"
            onClick={() => loadAppointments(page + 1, true)}
          >
            Load more
          </button>
        )}
      </section>
      {selected && (
        <div
          className="patient-modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <section
            className="patient-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reschedule-title"
          >
            <button
              className="icon-button"
              type="button"
              aria-label="Close reschedule dialog"
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
            <h2 id="reschedule-title">Request a reschedule</h2>
            <p>
              Your current appointment stays in place until the care team
              reviews your request.
            </p>
            <form className="patient-booking-form" onSubmit={submitReschedule}>
              <label>
                Preferred date
                <input
                  name="proposedDate"
                  type="date"
                  min={todayInManila()}
                  required
                />
              </label>
              <label>
                Preferred time
                <input name="proposedTime" type="time" required />
              </label>
              <label className="profile-field-wide">
                Reason
                <textarea name="reason" rows="3" maxLength="500" />
              </label>
              <button
                className="dashboard-primary-button profile-field-wide"
                type="submit"
                disabled={saving}
              >
                {saving ? "Sending…" : "Send request"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function PageState({ message, error, retry }) {
  return error ? (
    <div className="dashboard-state-card">
      <RefreshCw size={22} />
      <h2>We couldn’t load your appointments</h2>
      <p>{error}</p>
      <button
        className="dashboard-primary-button"
        type="button"
        onClick={retry}
      >
        Try again
      </button>
    </div>
  ) : (
    <div className="dashboard-state-card">
      <span className="dashboard-state-loader" />
      <h2>{message}</h2>
    </div>
  );
}

export default AppointmentsPage;
