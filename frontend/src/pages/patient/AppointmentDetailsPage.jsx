import { todayInManila } from "../../utils/patientFormatters";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, RefreshCw, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DashboardEmptyState,
  StatusBadge,
} from "../../components/dashboard/DashboardPrimitives";
import { getApiErrorMessage } from "../../services/api/authApi";
import {
  getAppointment,
  requestReschedule,
  syncAppointmentCalendar,
} from "../../services/api/patientApi";
import {
  appointmentDate,
  appointmentTime,
  therapistName,
} from "../../utils/patientFormatters";
import { showPromise } from "../../utils/toast";
import { PageSkeleton } from "../../components/loading/PageSkeleton";

function AppointmentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);

  useEffect(() => {
    getAppointment(id)
      .then((response) => setAppointment(response.data?.appointment))
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const request = requestReschedule(id, {
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
      const response = await request;
      setAppointment(response.data?.appointment);
      setRescheduling(false);
    } catch {
      return;
    } finally {
      setSaving(false);
    }
  }

  async function syncCalendar() {
    setCalendarSaving(true);
    const request = syncAppointmentCalendar(id);
    showPromise(request, {
      loading: "Connecting appointment to Google Calendar...",
      success: "Appointment added to Google Calendar.",
      error: "Couldn't sync this appointment to Google Calendar.",
    });
    try {
      const response = await request;
      setAppointment((current) => ({
        ...current,
        googleEventId: response.data?.googleEventId,
        googleEventLink: response.data?.googleEventLink,
      }));
    } catch {
      return;
    } finally {
      setCalendarSaving(false);
    }
  }

  if (loading) return <PageSkeleton variant="table" />;
  if (error || !appointment)
    return (
      <main className="dashboard-content">
        <section className="dashboard-section">
          <DashboardEmptyState
            icon={<RefreshCw size={22} />}
            title="Appointment unavailable"
            message={error || "We couldn’t find that appointment."}
            action={
              <Link
                className="dashboard-primary-button"
                to="/dashboard/appointments"
              >
                Back to appointments
              </Link>
            }
          />
        </section>
      </main>
    );

  const therapist = appointment.therapist;
  const canReschedule =
    ["pending", "confirmed"].includes(appointment.status) &&
    appointment.rescheduleRequest?.status !== "requested";

  return (
    <main className="dashboard-content">
      <section className="dashboard-section patient-page-section">
        <button
          className="subtle-action"
          type="button"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={15} /> Back to appointments
        </button>
        <div className="section-title-row">
          <div>
            <p className="dashboard-eyebrow">Appointment details</p>
            <h1>{appointment.service?.name || "Therapy appointment"}</h1>
          </div>
          <StatusBadge
            status={
              appointment.rescheduleRequest?.status === "requested"
                ? "Reschedule requested"
                : appointment.status
            }
          />
        </div>
        <div className="appointment-detail-grid">
          <div>
            <span>Date</span>
            <strong>{appointmentDate(appointment)}</strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{appointmentTime(appointment)}</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>
              {appointment.service?.duration
                ? `${appointment.service.duration} minutes`
                : "To be confirmed"}
            </strong>
          </div>
          <div>
            <span>Therapist</span>
            <strong>{therapistName(therapist)}</strong>
          </div>
        </div>
        <div className="appointment-therapist-card">
          <span className="avatar profile-avatar">
            {therapist ? (
              `${therapist.firstname?.[0] || ""}${therapist.lastname?.[0] || ""}`
            ) : (
              <UserRound size={20} />
            )}
          </span>
          <div>
            <strong>{therapistName(therapist)}</strong>
            <span>
              {therapist?.specialization ||
                (therapist
                  ? "Physical therapist"
                  : "Your therapist will be assigned after confirmation")}
            </span>
          </div>
        </div>
        <div className="appointment-detail-actions">
          {canReschedule && (
            <button
              className="dashboard-primary-button"
              type="button"
              onClick={() => setRescheduling(true)}
            >
              Request reschedule
            </button>
          )}
          {appointment.status === "confirmed" &&
            (appointment.googleEventLink ? (
              <a
                className="subtle-action"
                href={appointment.googleEventLink}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarDays size={15} /> Synced to Google Calendar
              </a>
            ) : (
              <button
                className="subtle-action"
                type="button"
                onClick={syncCalendar}
                disabled={calendarSaving}
              >
                <CalendarDays size={15} />{" "}
                {calendarSaving ? "Syncing…" : "Add to Google Calendar"}
              </button>
            ))}
        </div>
      </section>
      {rescheduling && (
        <div className="patient-modal-backdrop">
          <section
            className="patient-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-reschedule-title"
          >
            <h2 id="detail-reschedule-title">Request a reschedule</h2>
            <form className="patient-booking-form" onSubmit={submit}>
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
                <textarea name="reason" rows="3" />
              </label>
              {error && (
                <p className="profile-error profile-field-wide">{error}</p>
              )}
              <div className="profile-edit-actions">
                <button
                  className="profile-cancel-button"
                  type="button"
                  onClick={() => setRescheduling(false)}
                >
                  Cancel
                </button>
                <button
                  className="dashboard-primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Sending…" : "Send request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default AppointmentDetailsPage;
