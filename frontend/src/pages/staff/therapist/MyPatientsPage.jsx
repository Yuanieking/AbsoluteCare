import { useEffect, useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/dashboard/PageHeader";
import { DashboardEmptyState } from "../../../components/dashboard/DashboardPrimitives";
import {
  InlineErrorCard,
  StaffTableSkeleton,
} from "../../../components/dashboard/Skeleton";
import {
  EmptyCellValue,
  PatientCell,
  TableActionLink,
} from "../../../components/dashboard/TablePrimitives";
import { getTherapistPatients } from "../../../services/api/therapistApi";
import {
  formatDateManila,
  formatDateTimeManila,
} from "../../../utils/patientFormatters";

function MyPatientsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patientsData, setPatientsData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Patient detail modal state
  const [selectedPatientItem, setSelectedPatientItem] = useState(null);

  function fetchPatients(showSpinner = false) {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    return getTherapistPatients()
      .then((response) => {
        setPatientsData(response.data?.patients || []);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || "Failed to load patients.");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore) fetchPatients(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patientsData;
    return patientsData.filter(({ patient, dependent }) => {
      const pFirst = patient?.firstname || patient?.firstName || "";
      const pLast = patient?.lastname || patient?.lastName || "";
      const fullName = `${pFirst} ${pLast}`.toLowerCase();
      const email = (patient?.email || "").toLowerCase();
      const depName = dependent
        ? `${dependent.firstName || ""} ${dependent.lastName || ""}`.toLowerCase()
        : "";

      return fullName.includes(q) || email.includes(q) || depName.includes(q);
    });
  }, [patientsData, searchQuery]);

  function handleRowClick(item) {
    setSelectedPatientItem(item);
  }

  return (
    <main className="staff-dashboard-content">
      <PageHeader
        eyebrow="CARE RELATIONSHIPS"
        title="My patients"
        description="People assigned to your care, with their next touchpoint."
      />

      {error && (
        <InlineErrorCard message={error} onRetry={() => fetchPatients(true)} />
      )}

      <div className="staff-table-card">
        {/* Search Bar */}
        <div className="staff-search-bar">
          <Search
            size={16}
            style={{ color: "var(--ink-soft)" }}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search by patient name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search patients"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-soft)",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {loading ? (
          <StaffTableSkeleton rows={5} columns={4} />
        ) : filteredPatients.length > 0 ? (
          <div className="staff-table-shell">
            <table className="staff-table">
              <thead>
                <tr>
                  <th style={{ width: "42%" }}>Patient</th>
                  <th style={{ width: "26%" }}>Next appointment</th>
                  <th style={{ width: "20%" }}>Last session</th>
                  <th style={{ width: "12%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((item) => {
                  const {
                    patient,
                    dependent,
                    nextAppointment,
                    lastSessionDate,
                  } = item;
                  const isDependent = Boolean(dependent);
                  const displayName = isDependent
                    ? `${dependent.firstName || ""} ${dependent.lastName || ""}`.trim()
                    : `${patient.firstname || patient.firstName || ""} ${patient.lastname || patient.lastName || ""}`.trim() ||
                      "Patient";
                  const guardianName = isDependent
                    ? `${patient.firstname || patient.firstName || ""} ${patient.lastname || patient.lastName || ""}`.trim()
                    : null;
                  const email = patient.email || "";

                  return (
                    <tr
                      key={patient._id + (dependent?._id || "")}
                      className="is-clickable"
                      onClick={() => handleRowClick(item)}
                      role="row"
                    >
                      <td>
                        <PatientCell
                          name={displayName}
                          subtitle={email}
                          avatarUrl={patient.profilePicture}
                          isDependent={isDependent}
                          guardianName={guardianName}
                        />
                      </td>
                      <td>
                        {nextAppointment?.scheduledStart ? (
                          <strong>
                            {formatDateTimeManila(
                              nextAppointment.scheduledStart,
                            )}
                          </strong>
                        ) : (
                          <EmptyCellValue>None scheduled</EmptyCellValue>
                        )}
                      </td>
                      <td>
                        {lastSessionDate ? (
                          <span>{formatDateManila(lastSessionDate)}</span>
                        ) : (
                          <EmptyCellValue>No session yet</EmptyCellValue>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <TableActionLink
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(item);
                          }}
                        >
                          View
                        </TableActionLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : searchQuery ? (
          <DashboardEmptyState
            icon={<Search size={24} />}
            title="No patients match your search"
            message={`No records found matching "${searchQuery}". Check the spelling or clear the filter.`}
            action={
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </button>
            }
          />
        ) : (
          <DashboardEmptyState
            icon={<Users size={24} />}
            title="No patients assigned yet"
            message="When patients schedule visits or are assigned to your care, they will appear here."
          />
        )}
      </div>

      {/* Patient Detail Modal */}
      {selectedPatientItem && (
        <div
          className="therapist-dialog-backdrop"
          onClick={() => setSelectedPatientItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="therapist-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Patient profile</h3>
            <div style={{ margin: "16px 0" }}>
              <PatientCell
                name={
                  selectedPatientItem.dependent
                    ? `${selectedPatientItem.dependent.firstName} ${selectedPatientItem.dependent.lastName}`
                    : `${selectedPatientItem.patient?.firstname} ${selectedPatientItem.patient?.lastname}`
                }
                subtitle={selectedPatientItem.patient?.email}
                avatarUrl={selectedPatientItem.patient?.profilePicture}
                isDependent={Boolean(selectedPatientItem.dependent)}
                guardianName={
                  selectedPatientItem.dependent
                    ? `${selectedPatientItem.patient?.firstname} ${selectedPatientItem.patient?.lastname}`
                    : null
                }
              />
            </div>

            <div
              style={{
                background: "var(--paper)",
                padding: "14px",
                borderRadius: "8px",
                fontSize: "13px",
                display: "grid",
                gap: "8px",
              }}
            >
              <div>
                <span style={{ color: "var(--ink-soft)" }}>
                  Contact email:{" "}
                </span>
                <strong>{selectedPatientItem.patient?.email || "—"}</strong>
              </div>
              {selectedPatientItem.patient?.phone && (
                <div>
                  <span style={{ color: "var(--ink-soft)" }}>Phone: </span>
                  <strong>{selectedPatientItem.patient.phone}</strong>
                </div>
              )}
              <div>
                <span style={{ color: "var(--ink-soft)" }}>
                  Next appointment:{" "}
                </span>
                <strong>
                  {selectedPatientItem.nextAppointment?.scheduledStart
                    ? formatDateTimeManila(
                        selectedPatientItem.nextAppointment.scheduledStart,
                      )
                    : "None scheduled"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--ink-soft)" }}>Last session: </span>
                <strong>
                  {selectedPatientItem.lastSessionDate
                    ? formatDateManila(selectedPatientItem.lastSessionDate)
                    : "No session recorded yet"}
                </strong>
              </div>
            </div>

            <div className="therapist-dialog-actions">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setSelectedPatientItem(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="dashboard-primary-button"
                onClick={() => {
                  setSelectedPatientItem(null);
                  navigate("/staff/therapist/my-appointments");
                }}
              >
                View appointments
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default MyPatientsPage;
