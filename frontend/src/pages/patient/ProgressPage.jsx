import { useState } from "react";
import { ArrowUpRight, CalendarCheck2, RefreshCw, X } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { DashboardEmptyState } from "../../components/dashboard/DashboardPrimitives";
import { getSession } from "../../services/api/patientApi";
import { getApiErrorMessage } from "../../services/api/authApi";
import {
  formatAppointmentDate,
  therapistName,
} from "../../utils/patientFormatters";
import { PageSkeleton } from "../../components/loading/PageSkeleton";

function ProgressPage() {
  const { sessionHistory, sessionsCompleted, loading, error, retry } =
    useOutletContext();
  const [selected, setSelected] = useState(null);
  const [detailError, setDetailError] = useState("");

  async function openSession(id) {
    setDetailError("");
    try {
      const response = await getSession(id);
      setSelected(response.data?.session);
    } catch (requestError) {
      setDetailError(getApiErrorMessage(requestError));
    }
  }

  if (loading) return <PageSkeleton variant="cards" />;
  if (error)
    return (
      <main className="dashboard-content">
        <section className="dashboard-section">
          <DashboardEmptyState
            icon={<RefreshCw size={22} />}
            title="We couldn’t load your progress"
            message={error}
            action={
              <button
                className="dashboard-primary-button"
                type="button"
                onClick={retry}
              >
                Try again
              </button>
            }
          />
        </section>
      </main>
    );

  return (
    <main className="dashboard-content">
      <section className="dashboard-section patient-page-section">
        <div className="section-title-row">
          <div>
            <p className="dashboard-eyebrow">Keep track of your care</p>
            <h1>Therapy progress</h1>
          </div>
          <Link className="subtle-action" to="/dashboard/appointments">
            View appointments <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="progress-overview">
          <strong>{sessionsCompleted}</strong>
          <span>sessions completed</span>
        </div>
      </section>
      <section className="dashboard-section history-section">
        <div className="section-title-row">
          <div>
            <p className="dashboard-eyebrow">Your completed visits</p>
            <h2>Session history</h2>
          </div>
        </div>
        {sessionHistory.length ? (
          <div className="history-list">
            {sessionHistory.map((session) => (
              <button
                className="history-item history-item-button"
                key={session._id}
                type="button"
                onClick={() => openSession(session._id)}
              >
                <span className="history-marker">
                  <CalendarCheck2 size={14} />
                </span>
                <span>
                  <strong>{formatAppointmentDate(session.sessionDate)}</strong>
                  <span>
                    {session.service?.name || "Therapy session"} <i />{" "}
                    {therapistName(session.therapist)}
                  </span>
                  <small>{session.durationMinutes} minutes</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <DashboardEmptyState
            icon={<CalendarCheck2 size={22} />}
            title="No session history yet"
            message="Completed visits and therapist notes will appear here."
          />
        )}
      </section>
      {detailError && (
        <p className="profile-error" role="alert">
          {detailError}
        </p>
      )}
      {selected && (
        <div
          className="patient-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <section
            className="patient-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-title"
          >
            <button
              className="icon-button"
              type="button"
              aria-label="Close session details"
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
            <p className="dashboard-eyebrow">Session details</p>
            <h2 id="session-title">
              {selected.service?.name || "Therapy session"}
            </h2>
            <div className="appointment-detail-grid">
              <div>
                <span>Date</span>
                <strong>{formatAppointmentDate(selected.sessionDate)}</strong>
              </div>
              <div>
                <span>Duration</span>
                <strong>{selected.durationMinutes} minutes</strong>
              </div>
              <div>
                <span>Therapist</span>
                <strong>{therapistName(selected.therapist)}</strong>
              </div>
            </div>
            <div className="session-notes">
              <span>Notes from your therapist</span>
              <p>
                {selected.patientVisibleNotes ||
                  "No notes were shared for this session."}
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default ProgressPage;
