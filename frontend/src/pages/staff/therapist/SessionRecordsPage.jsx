import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import PageHeader from '../../../components/dashboard/PageHeader'
import { DashboardEmptyState } from '../../../components/dashboard/DashboardPrimitives'
import {
  InlineErrorCard,
  StaffTableSkeleton,
} from '../../../components/dashboard/Skeleton'
import {
  PatientCell,
  TableActionLink,
  TruncatedText,
} from '../../../components/dashboard/TablePrimitives'
import {
  getTherapistSessions,
  updateTherapySession,
} from '../../../services/api/therapistApi'
import { formatDateManila } from '../../../utils/patientFormatters'
import { showPromise } from '../../../utils/toast'

function SessionRecordsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessions, setSessions] = useState([])
  const [editing, setEditing] = useState(null)

  function fetchSessions(showSpinner = false) {
    if (showSpinner) {
      setLoading(true)
    }
    setError(null)
    return getTherapistSessions()
      .then((response) => setSessions(response.data?.sessions || []))
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load session records.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchSessions(false)
  }, [])

  async function save(event) {
    event.preventDefault()
    if (!editing) return
    const form = new FormData(event.currentTarget)
    const request = updateTherapySession(editing._id, {
      sessionDate: form.get('sessionDate'),
      durationMinutes: Number(form.get('durationMinutes')),
      notes: form.get('notes'),
    })
    showPromise(request, {
      loading: 'Saving session record...',
      success: 'Session record updated successfully.',
      error: "Couldn't update the session record.",
    })
    try {
      await request
      setEditing(null)
      fetchSessions(false)
    } catch {
      // toast handles error
    }
  }

  return (
    <main className="staff-dashboard-content">
      <PageHeader
        eyebrow="CLINICAL RECORDS"
        title="Session records"
        description="Review and refine notes from your completed visits."
      />

      {error && <InlineErrorCard message={error} onRetry={() => fetchSessions(true)} />}

      <div className="staff-table-card">
        {loading ? (
          <StaffTableSkeleton rows={5} columns={5} />
        ) : sessions.length > 0 ? (
          <div className="staff-table-shell">
            <table className="staff-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Patient</th>
                  <th style={{ width: '20%' }}>Session date</th>
                  <th style={{ width: '25%' }}>Service</th>
                  <th style={{ width: '12%' }}>Duration</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((item) => {
                  const patientName = `${item.patient?.firstname || item.patient?.firstName || ''} ${item.patient?.lastname || item.patient?.lastName || ''}`.trim() || 'Patient'
                  const patientEmail = item.patient?.email || ''
                  const serviceName = item.service?.name || 'Therapy Session'

                  return (
                    <tr
                      key={item._id}
                      className="is-clickable"
                      onClick={() => setEditing(item)}
                      role="row"
                    >
                      <td>
                        <PatientCell
                          name={patientName}
                          subtitle={patientEmail}
                          avatarUrl={item.patient?.profilePicture}
                        />
                      </td>
                      <td>
                        <strong>{formatDateManila(item.sessionDate)}</strong>
                      </td>
                      <td>
                        <TruncatedText text={serviceName} maxWidth="220px" />
                      </td>
                      <td>
                        <span>{item.durationMinutes} min</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <TableActionLink
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(item)
                          }}
                        >
                          Edit
                        </TableActionLink>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <DashboardEmptyState
            icon={<ClipboardList size={24} />}
            title="No session records yet"
            message="Completed sessions and clinical documentation will appear here."
          />
        )}
      </div>

      {editing && (
        <div
          className="therapist-dialog-backdrop"
          onClick={() => setEditing(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="therapist-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Edit session record</h3>
            <p>
              Updating clinical record for{' '}
              <strong>
                {editing.patient?.firstname} {editing.patient?.lastname}
              </strong>
              .
            </p>
            <form onSubmit={save}>
              <div style={{ display: 'grid', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '6px',
                    }}
                  >
                    Session date
                  </label>
                  <input
                    name="sessionDate"
                    type="date"
                    defaultValue={editing.sessionDate?.slice(0, 10)}
                    max={new Date().toISOString().slice(0, 10)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--dashboard-border)',
                      borderRadius: '6px',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '6px',
                    }}
                  >
                    Duration (minutes)
                  </label>
                  <input
                    name="durationMinutes"
                    type="number"
                    min="1"
                    defaultValue={editing.durationMinutes}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--dashboard-border)',
                      borderRadius: '6px',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      marginBottom: '6px',
                    }}
                  >
                    Clinical notes
                  </label>
                  <textarea
                    name="notes"
                    defaultValue={
                      editing.clinicalNotes || editing.notes || editing.patientVisibleNotes || ''
                    }
                    rows="5"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--dashboard-border)',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>
              <div className="therapist-dialog-actions">
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="dashboard-primary-button">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default SessionRecordsPage
