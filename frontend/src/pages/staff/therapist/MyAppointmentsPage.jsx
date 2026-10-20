import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../../../components/dashboard/PageHeader";
import {
  DashboardEmptyState,
  StatusBadge,
} from "../../../components/dashboard/DashboardPrimitives";
import {
  InlineErrorCard,
  StaffTableSkeleton,
} from "../../../components/dashboard/Skeleton";
import TabBar from "../../../components/dashboard/TabBar";
import {
  PatientCell,
  TableActionLink,
  TruncatedText,
} from "../../../components/dashboard/TablePrimitives";
import {
  createTherapySession,
  getTherapistAppointments,
  markAppointmentNoShow,
  requestTherapistReschedule,
} from "../../../services/api/therapistApi";
import {
  formatDateTimeManila,
  formatRequestedDateTimeManila,
} from "../../../utils/patientFormatters";
import { showPromise } from "../../../utils/toast";

function MyAppointmentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allAppointments, setAllAppointments] = useState([]);
  const [activeAppointments, setActiveAppointments] = useState([]);

  // Modal dialog states
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [sessionTarget, setSessionTarget] = useState(null);
  const [noShowTarget, setNoShowTarget] = useState(null);
  const [currentTime] = useState(() => Date.now());
  const now = new Date(currentTime);

  function fetchAppointments(activeTab, showSpinner = false) {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);

    // Load both full list (for tab counts) and current filter
    return Promise.all([
      getTherapistAppointments(),
      activeTab ? getTherapistAppointments(activeTab) : Promise.resolve(null),
    ])
      .then(([allRes, filteredRes]) => {
        const fullList = allRes.data?.appointments || [];
        setAllAppointments(fullList);
        if (filteredRes) {
          setActiveAppointments(filteredRes.data?.appointments || []);
        } else {
          setActiveAppointments(fullList);
        }
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message || "Failed to load appointments.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore) fetchAppointments(tab, false);
    });
    return () => {
      ignore = true;
    };
  }, [tab]);

  // Calculate tab counts
  const counts = useMemo(() => {
    const total = allAppointments.length;
    const upcoming = allAppointments.filter((item) => {
      if (item.status === "cancelled") return false;
      return (
        item.status === "confirmed" ||
        item.status === "pending" ||
        (item.scheduledStart &&
          new Date(item.scheduledStart).getTime() >= currentTime)
      );
    }).length;
    const previous = allAppointments.filter((item) => {
      if (
        item.status === "completed" ||
        item.status === "no_show" ||
        item.status === "no-show"
      )
        return true;
      return (
        item.scheduledStart &&
        new Date(item.scheduledStart).getTime() < currentTime
      );
    }).length;
    return { total, upcoming, previous };
  }, [allAppointments, currentTime]);

  const tabsConfig = [
    { key: "", label: "Assigned / all", count: counts.total },

    { key: "upcoming", label: "Upcoming", count: counts.upcoming },
    { key: "previous", label: "Previous", count: counts.previous },
  ];

  const sortedActiveAppointments = useMemo(
    () =>
      [...activeAppointments].sort((first, second) => {
        const firstDate = first.scheduledStart || first.requestedDate || "";
        const secondDate = second.scheduledStart || second.requestedDate || "";
        return new Date(secondDate).getTime() - new Date(firstDate).getTime();
      }),
    [activeAppointments],
  );

  function handleTabChange(newTab) {
    if (newTab) {
      setSearchParams({ tab: newTab });
    } else {
      setSearchParams({});
    }
  }

  // Action handlers
  async function handleRescheduleSubmit(e) {
    e.preventDefault();
    if (!rescheduleTarget) return;
    const form = new FormData(e.currentTarget);
    const payload = {
      proposedDate: form.get("proposedDate"),
      proposedTime: form.get("proposedTime"),
      reason: form.get("reason"),
    };

    const request = requestTherapistReschedule(rescheduleTarget._id, payload);
    showPromise(request, {
      loading: "Submitting reschedule request...",
      success: "Reschedule request sent to patient.",
      error: "Could not submit reschedule request.",
    });

    try {
      await request;
      setRescheduleTarget(null);
      fetchAppointments(tab, false);
    } catch {
      // toast handles error
    }
  }

  async function handleSessionSubmit(e) {
    e.preventDefault();
    if (!sessionTarget) return;
    const form = new FormData(e.currentTarget);
    const payload = {
      durationMinutes: Number(form.get("durationMinutes")),
      notes: form.get("notes"),
    };

    const request = createTherapySession(sessionTarget._id, payload);
    showPromise(request, {
      loading: "Recording therapy session notes...",
      success: "Session notes recorded successfully.",
      error: "Could not record therapy session.",
    });

    try {
      await request;
      setSessionTarget(null);
      fetchAppointments(tab, false);
    } catch {
      // toast handles error
    }
  }

  async function handleNoShowConfirm() {
    if (!noShowTarget) return;
    const request = markAppointmentNoShow(noShowTarget._id);
    showPromise(request, {
      loading: "Marking appointment as no-show...",
      success: "Appointment marked as no-show.",
      error: "Could not mark appointment as no-show.",
    });

    try {
      await request;
      setNoShowTarget(null);
      fetchAppointments(tab, false);
    } catch {
      // toast handles error
    }
  }

  return (
    <main className="staff-dashboard-content">
      <PageHeader
        eyebrow="MY CARE DESK"
        title="My appointments"
        description="Review your assigned visits and next actions."
      />

      {error && (
        <InlineErrorCard
          message={error}
          onRetry={() => fetchAppointments(tab, true)}
        />
      )}

      <div className="staff-table-card">
        <TabBar
          tabs={tabsConfig}
          activeTab={tab}
          onChange={handleTabChange}
          ariaLabel="Appointments filter"
        />

        {loading ? (
          <StaffTableSkeleton rows={5} columns={5} />
        ) : activeAppointments.length > 0 ? (
          <div className="staff-table-shell">
            <table className="staff-table">
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Date & time</th>
                  <th style={{ width: "26%" }}>Patient</th>
                  <th style={{ width: "24%" }}>Service</th>
                  <th style={{ width: "13%" }}>Status</th>
                  <th style={{ width: "15%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedActiveAppointments.map((item) => {
                  const isCancelled = item.status === "cancelled";
                  const isConfirmed = item.status === "confirmed";
                  const isPending = item.status === "pending";
                  const visitDate = item.scheduledStart
                    ? new Date(item.scheduledStart)
                    : null;
                  const isFuture = visitDate ? visitDate >= now : true;
                  const isPast = visitDate ? visitDate < now : false;

                  const formattedDate = item.scheduledStart
                    ? formatDateTimeManila(item.scheduledStart)
                    : formatRequestedDateTimeManila(
                        item.requestedDate,
                        item.requestedTime,
                      );

                  const patientName =
                    `${item.patient?.firstname || item.patient?.firstName || ""} ${item.patient?.lastname || item.patient?.lastName || ""}`.trim() ||
                    "Patient";
                  const patientEmail = item.patient?.email || "";
                  const serviceName = item.service?.name || "Therapy Session";

                  return (
                    <tr
                      key={item._id}
                      className={`is-clickable${isCancelled ? " is-cancelled" : ""}`}
                      onClick={() =>
                        navigate(`/staff/therapist/appointments/${item._id}`)
                      }
                      role="row"
                    >
                      <td>
                        <strong>{formattedDate}</strong>
                      </td>
                      <td>
                        <PatientCell
                          name={patientName}
                          subtitle={patientEmail}
                          avatarUrl={item.patient?.profilePicture}
                        />
                      </td>
                      <td>
                        <TruncatedText text={serviceName} maxWidth="240px" />
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div
                          className="staff-row-actions"
                          style={{ justifyContent: "flex-end" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isCancelled && (
                            <>
                              {(isPending || isConfirmed) && isFuture && (
                                <button
                                  type="button"
                                  className="shared-table-btn-secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRescheduleTarget(item);
                                  }}
                                  title="Request reschedule"
                                >
                                  Reschedule
                                </button>
                              )}
                              {isConfirmed && isPast && (
                                <>
                                  <button
                                    type="button"
                                    className="shared-table-btn-secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSessionTarget(item);
                                    }}
                                    title="Record session notes"
                                  >
                                    Record
                                  </button>
                                  <button
                                    type="button"
                                    className="shared-table-btn-secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNoShowTarget(item);
                                    }}
                                    title="Mark patient as no-show"
                                  >
                                    No-show
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          <TableActionLink
                            to={`/staff/therapist/appointments/${item._id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </TableActionLink>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <DashboardEmptyState
            icon={<CalendarDays size={24} />}
            title={
              tab === "upcoming"
                ? "No upcoming appointments"
                : tab === "previous"
                  ? "No previous appointments"
                  : "No appointments assigned"
            }
            message={
              tab === "upcoming"
                ? "Your next confirmed appointments will appear here."
                : tab === "previous"
                  ? "Completed and previous visits will be recorded here."
                  : "No appointments currently match this filter."
            }
            action={
              tab !== "" && (
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={() => handleTabChange("")}
                >
                  View all appointments
                </button>
              )
            }
          />
        )}
      </div>

      {/* Reschedule Request Modal */}
      {rescheduleTarget && (
        <div
          className="therapist-dialog-backdrop"
          onClick={() => setRescheduleTarget(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="therapist-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Request appointment reschedule</h3>
            <p>
              Propose a new schedule for{" "}
              <strong>
                {rescheduleTarget.patient?.firstname}{" "}
                {rescheduleTarget.patient?.lastname}
              </strong>
              .
            </p>
            <form onSubmit={handleRescheduleSubmit}>
              <div
                style={{ display: "grid", gap: "14px", marginBottom: "16px" }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "6px",
                    }}
                  >
                    Proposed date
                  </label>
                  <input
                    type="date"
                    name="proposedDate"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--dashboard-border)",
                      borderRadius: "6px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "6px",
                    }}
                  >
                    Proposed time
                  </label>
                  <input
                    type="time"
                    name="proposedTime"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--dashboard-border)",
                      borderRadius: "6px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "6px",
                    }}
                  >
                    Reason for reschedule
                  </label>
                  <textarea
                    name="reason"
                    rows={3}
                    placeholder="Provide a clear note for the patient..."
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--dashboard-border)",
                      borderRadius: "6px",
                    }}
                  />
                </div>
              </div>
              <div className="therapist-dialog-actions">
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={() => setRescheduleTarget(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="dashboard-primary-button">
                  Send request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Session Modal */}
      {sessionTarget && (
        <div
          className="therapist-dialog-backdrop"
          onClick={() => setSessionTarget(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="therapist-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Record therapy session</h3>
            <p>
              Document clinical notes for{" "}
              <strong>
                {sessionTarget.patient?.firstname}{" "}
                {sessionTarget.patient?.lastname}
              </strong>
              .
            </p>
            <form onSubmit={handleSessionSubmit}>
              <div
                style={{ display: "grid", gap: "14px", marginBottom: "16px" }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "6px",
                    }}
                  >
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="durationMinutes"
                    defaultValue={60}
                    min={15}
                    max={180}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--dashboard-border)",
                      borderRadius: "6px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "6px",
                    }}
                  >
                    Session notes & observations
                  </label>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Patient progress, exercises completed, clinical evaluation..."
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--dashboard-border)",
                      borderRadius: "6px",
                    }}
                  />
                </div>
              </div>
              <div className="therapist-dialog-actions">
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={() => setSessionTarget(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="dashboard-primary-button">
                  Save session record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark No-Show Modal */}
      {noShowTarget && (
        <div
          className="therapist-dialog-backdrop"
          onClick={() => setNoShowTarget(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="therapist-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Mark visit as no-show</h3>
            <p>
              Confirm that{" "}
              <strong>
                {noShowTarget.patient?.firstname}{" "}
                {noShowTarget.patient?.lastname}
              </strong>{" "}
              did not attend this scheduled visit on{" "}
              {formatDateTimeManila(noShowTarget.scheduledStart)}.
            </p>
            <div className="therapist-dialog-actions">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setNoShowTarget(null)}
              >
                Go back
              </button>
              <button
                type="button"
                className="dashboard-primary-button"
                style={{ background: "#b91c1c" }}
                onClick={handleNoShowConfirm}
              >
                Confirm no-show
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default MyAppointmentsPage;
