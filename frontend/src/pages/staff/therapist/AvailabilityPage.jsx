import { useEffect, useState } from 'react'
import { CalendarDays, Clock3, LoaderCircle } from 'lucide-react'
import PageHeader from '../../../components/dashboard/PageHeader'
import {
  getTherapistCalendarConnectUrl,
  getTherapistCalendarStatus,
  getTherapistProfile,
  disconnectTherapistCalendar,
  updateAvailability,
} from '../../../services/api/therapistApi'
import { showError, showPromise } from '../../../utils/toast'

const defaultHours = { start: '08:00', end: '17:00' }

function AvailabilityPage() {
  const [days, setDays] = useState([])
  const [hours, setHours] = useState(defaultHours)
  const [savedAvailability, setSavedAvailability] = useState({
    workingDays: [],
    workingHours: defaultHours,
  })
  const [calendar, setCalendar] = useState({ connected: false, email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const isDirty =
    JSON.stringify({ workingDays: days, workingHours: hours }) !==
    JSON.stringify(savedAvailability)

  useEffect(() => {
    Promise.all([getTherapistProfile(), getTherapistCalendarStatus()])
      .then(([profile, status]) => {
        const workingDays = profile.data.profile?.workingDays || []
        const workingHours = profile.data.profile?.workingHours || defaultHours
        setDays(workingDays)
        setHours(workingHours)
        setSavedAvailability({ workingDays, workingHours })
        setCalendar(status.data || { connected: false, email: '' })
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!hours.start || !hours.end || hours.start >= hours.end) {
      showError('Choose an end time after the start time.')
      return
    }

    setSaving(true)
    const request = updateAvailability({
      workingDays: days,
      workingHours: hours,
    })
    showPromise(request, {
      loading: 'Saving availability...',
      success: 'Availability updated successfully.',
      error: "Couldn't save availability.",
    })
    try {
      const response = await request
      const savedProfile = response.data?.profile
      if (savedProfile) {
        setSavedAvailability({
          workingDays: savedProfile.workingDays || days,
          workingHours: savedProfile.workingHours || hours,
        })
      } else {
        setSavedAvailability({ workingDays: days, workingHours: hours })
      }
    } catch {
      return
    } finally {
      setSaving(false)
    }
  }

  function discardChanges() {
    setDays(savedAvailability.workingDays)
    setHours(savedAvailability.workingHours)
  }

  async function disconnectCalendar() {
    const request = disconnectTherapistCalendar()
    showPromise(request, {
      loading: 'Disconnecting Google Calendar...',
      success: 'Google Calendar disconnected.',
      error: "Couldn't disconnect Google Calendar.",
    })
    try {
      await request
      setCalendar({ connected: false, email: '' })
    } catch {
      return
    }
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <main className="staff-dashboard-content">
      <PageHeader
        eyebrow="MY CARE DESK"
        title="My availability"
        description="Set working days and hours for your schedule."
        action={
          <div className="availability-header-actions" style={{ display: 'flex', gap: '10px' }}>
            {isDirty && (
              <button
                className="dashboard-secondary-button"
                type="button"
                onClick={discardChanges}
                disabled={saving}
              >
                Discard changes
              </button>
            )}
            <button
              className="dashboard-primary-button"
              type="button"
              onClick={save}
              disabled={!isDirty || saving || loading}
            >
              {saving ? (
                <>
                  <LoaderCircle
                    className="staff-spinner"
                    size={15}
                    aria-hidden="true"
                  />
                  <span>Saving...</span>
                </>
              ) : (
                'Save availability'
              )}
            </button>
          </div>
        }
      />

      <div className="staff-table-card">
        <div className="availability-panel">
          <div className="availability-card">
            <div className="availability-card-heading">
              <span className="availability-card-icon">
                <Clock3 size={18} />
              </span>
              <div>
                <h2>Working days</h2>
                <p>
                  Select the days and hours when you can receive appointments.
                </p>
              </div>
            </div>
            <div className="weekday-list">
              {weekdays.map((day) => (
                <button
                  className={days.includes(day) ? 'is-selected' : ''}
                  type="button"
                  key={day}
                  onClick={() =>
                    setDays((current) =>
                      current.includes(day)
                        ? current.filter((item) => item !== day)
                        : [...current, day],
                    )
                  }
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="availability-helper">
              Selected days determine when the admin can assign you
              appointments.
            </p>
            <p className="availability-hours-label">
              Hours apply to all selected days.
            </p>
            <div className="availability-time-fields">
              <label>
                Starts
                <input
                  type="time"
                  value={hours.start}
                  onChange={(event) =>
                    setHours({ ...hours, start: event.target.value })
                  }
                />
              </label>
              <label>
                Ends
                <input
                  type="time"
                  value={hours.end}
                  onChange={(event) =>
                    setHours({ ...hours, end: event.target.value })
                  }
                />
              </label>
            </div>
          </div>

          <div className="calendar-sync">
            <div className="availability-card-heading">
              <span className="availability-card-icon">
                <CalendarDays size={18} />
              </span>
              <div>
                <h2>Google Calendar</h2>
                <p>Keep confirmed appointments visible in your calendar.</p>
              </div>
            </div>
            <div className="calendar-status">
              <span
                className={`calendar-status-dot${calendar.connected ? ' is-connected' : ''}`}
              />
              <span>{calendar.connected ? 'Connected' : 'Not connected'}</span>
            </div>
            {calendar.connected && calendar.email && (
              <p className="calendar-account">{calendar.email}</p>
            )}
            {calendar.connected ? (
              <button
                className="calendar-disconnect-button"
                type="button"
                onClick={disconnectCalendar}
              >
                Disconnect
              </button>
            ) : (
              <a
                className="calendar-connect-button"
                href={getTherapistCalendarConnectUrl()}
              >
                Connect
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default AvailabilityPage
