import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../../../components/dashboard/PageHeader";
import { StatusBadge } from "../../../components/dashboard/DashboardPrimitives";
import {
  createTherapySession,
  getTherapistAppointment,
  markAppointmentNoShow,
  requestTherapistReschedule,
} from "../../../services/api/therapistApi";
import { showPromise } from "../../../utils/toast";
import { StaffPageSkeleton } from "../../../components/loading/PageSkeleton";
import {
  formatDateTimeManila,
  formatRequestedDateTimeManila,
} from "../../../utils/patientFormatters";

function AppointmentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [mode, setMode] = useState("");

  useEffect(() => {
    getTherapistAppointment(id)
      .then((response) => setAppointment(response.data.appointment))
      .catch(() => navigate("/staff/therapist/my-appointments"));
  }, [id, navigate]);

  if (!appointment) return <StaffPageSkeleton variant="table" />;

  const canAct =
    ["pending", "confirmed"].includes(appointment.status) &&
    new Date(appointment.scheduledStart || 0) > new Date();

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    let request;
    let messages;
    if (mode === "reschedule") {
      request = requestTherapistReschedule(id, data);
      messages = {
        loading: "Submitting reschedule request...",
        success: "Reschedule request sent to patient.",
        error: "Couldn't submit the reschedule request.",
      };
    }
    if (mode === "session") {
      request = createTherapySession(id, {
        ...data,
        durationMinutes: Number(data.durationMinutes),
        notes: data.notes,
      });
      messages = {
        loading: "Recording therapy session...",
        success: "Therapy session recorded.",
        error: "Couldn't record the therapy session.",
      };
    }
    if (mode === "no-show") {
      request = markAppointmentNoShow(id);
      messages = {
        loading: "Marking appointment as no-show...",
        success: "Appointment marked as no-show.",
        error: "Couldn't mark the appointment as no-show.",
      };
    }
    showPromise(request, messages);
    try {
      await request;
      const response = await getTherapistAppointment(id);
      setAppointment(response.data.appointment);
      setMode("");
    } catch {
      return;
    }
  }

  const patientName =
    `${appointment.patient?.firstname || ""} ${appointment.patient?.lastname || ""}`.trim() ||
    "Patient";

  return (
    <main className="staff-dashboard-content">
      <PageHeader
        eyebrow="APPOINTMENT DETAILS"
        title={patientName}
        description={appointment.service?.name || "Therapy Visit"}
        action={
          <button
            type="button"
            className="dashboard-secondary-button"
            onClick={() => navigate("/staff/therapist/my-appointments")}
          >
            Back to appointments
          </button>
        }
      />

      <section className="staff-table-card therapist-appointment-card">
        <div className="therapist-detail-grid">
          <div>
            <span>Date and time</span>
            <strong>
              {appointment.scheduledStart
                ? formatDateTimeManila(appointment.scheduledStart)
                : formatRequestedDateTimeManila(
                    appointment.requestedDate,
                    appointment.requestedTime,
                  )}
            </strong>
          </div>
          <div>
            <span>Status</span>
            <StatusBadge status={appointment.status} />
          </div>
          <div>
            <span>Duration</span>
            <strong>{appointment.service?.duration || 60} minutes</strong>
          </div>
          <div>
            <span>Patient email</span>
            <strong>{appointment.patient?.email}</strong>
          </div>
        </div>

        <div className="therapist-action-row">
          {canAct && (
            <button
              type="button"
              className="dashboard-secondary-button"
              onClick={() => setMode("reschedule")}
            >
              Request reschedule
            </button>
          )}
          {appointment.status === "confirmed" &&
            new Date(appointment.scheduledStart) <= new Date() && (
              <>
                <button
                  type="button"
                  className="dashboard-primary-button"
                  onClick={() => setMode("session")}
                >
                  Record session
                </button>
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={() => setMode("no-show")}
                >
                  Mark no-show
                </button>
              </>
            )}
        </div>
      </section>

      {mode && (
        <div
          className="therapist-dialog-backdrop"
          onClick={() => setMode("")}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="therapist-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              {mode === "reschedule"
                ? "Request a new time"
                : mode === "session"
                  ? "Record therapy session"
                  : "Mark no-show"}
            </h3>
            <form onSubmit={submit}>
              {mode === "reschedule" && (
                <div className="therapist-form-grid">
                  <label className="therapist-form-label">
                    Proposed date
                    <input
                      className="therapist-form-control"
                      name="proposedDate"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </label>
                  <label className="therapist-form-label">
                    Proposed time
                    <input
                      className="therapist-form-control"
                      name="proposedTime"
                      type="time"
                      required
                    />
                  </label>
                  <label className="therapist-form-label">
                    Reason
                    <textarea
                      className="therapist-form-control"
                      name="reason"
                      rows={3}
                    />
                  </label>
                </div>
              )}
              {mode === "session" && (
                <div className="therapist-form-grid">
                  <label className="therapist-form-label">
                    Session date
                    <input
                      className="therapist-form-control"
                      name="sessionDate"
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </label>
                  <label className="therapist-form-label">
                    Duration (minutes)
                    <input
                      className="therapist-form-control"
                      name="durationMinutes"
                      type="number"
                      min="1"
                      defaultValue={60}
                      required
                    />
                  </label>
                  <label className="therapist-form-label">
                    Notes
                    <textarea
                      className="therapist-form-control"
                      name="notes"
                      rows={4}
                    />
                  </label>
                </div>
              )}
              {mode === "no-show" && (
                <p style={{ margin: "14px 0" }}>
                  This will close the appointment as a no-show. The action
                  cannot be undone by a therapist.
                </p>
              )}
              <div className="therapist-dialog-actions">
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={() => setMode("")}
                >
                  Cancel
                </button>
                <button
                  className="dashboard-primary-button"
                  type="submit"
                  data-danger={mode === "no-show" ? "true" : undefined}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default AppointmentDetailsPage;
