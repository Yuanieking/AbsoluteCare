import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import Skeleton from "../../../components/dashboard/Skeleton";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import { getAdminSessions } from "../../../services/api/adminMonitoringApi";
import { getToastError, showError } from "../../../utils/toast";
import { DashboardEmptyState } from "../../../components/dashboard/DashboardPrimitives";
import {
  formatAdminDate,
  formatAdminDuration,
} from "../../../utils/adminFormatters";

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    getAdminSessions()
      .then((response) => setSessions(response.data.sessions))
      .catch((error) =>
        showError(getToastError(error, "Unable to load session history.")),
      )
      .finally(() => setLoading(false));
  }, []);
  return (
    <main className="staff-dashboard-content">
      <section className="staff-dashboard-section staff-standalone-page">
        <StaffPageHeader
          eyebrow="Clinical oversight"
          title="Session history"
          description="Admin access includes full clinical notes for operational oversight."
        />
        {loading ? (
          <div className="staff-loading-block">
            <Skeleton variant="text" width="100%" height="46px" />
            <Skeleton variant="text" width="100%" height="46px" />
          </div>
        ) : sessions.length === 0 ? (
          <DashboardEmptyState
            icon={<Eye size={22} />}
            title="No sessions recorded yet"
            message="Completed sessions will appear here."
          />
        ) : (
          <div className="appointment-table-wrap">
            <table className="appointment-admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Therapist</th>
                  <th>Service</th>
                  <th>Duration</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session._id}>
                    <td>{formatAdminDate(session.sessionDate)}</td>
                    <td>
                      {session.patient?.firstname} {session.patient?.lastname}
                    </td>
                    <td>
                      {session.therapist?.firstname}{" "}
                      {session.therapist?.lastname}
                    </td>
                    <td>{session.service?.name || "Therapy session"}</td>
                    <td>{formatAdminDuration(session.durationMinutes)}</td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => setSelected(session)}
                        aria-label="View session"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <div
          className="staff-modal-backdrop"
          onMouseDown={() => setSelected(null)}
        >
          <section
            className="staff-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="staff-modal-header">
              <h2>Session notes</h2>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="user-detail-list">
              <div>
                <span>Patient-visible notes</span>
                <strong>
                  {selected.patientVisibleNotes || "No patient-visible notes."}
                </strong>
              </div>
              <div>
                <span>Clinical notes</span>
                <strong>
                  {selected.clinicalNotes || "No clinical notes."}
                </strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
