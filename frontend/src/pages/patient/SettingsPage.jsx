import { useEffect, useState } from "react";
import { Bell, CalendarDays, LockKeyhole } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "../../services/api/authApi";
import { updateNotificationPreferences } from "../../services/api/authApi";
import {
  disconnectCalendar,
  getCalendarConnectUrl,
  getCalendarStatus,
} from "../../services/api/patientApi";
import {
  getToastError,
  showError,
  showSuccess,
  showPromise,
} from "../../utils/toast";
import { useAuth } from "../../context/useAuth";

function SettingsPage() {
  const [searchParams] = useSearchParams();
  const [calendar, setCalendar] = useState({ connected: false, email: "" });
  const [error, setError] = useState("");
  const { user, setUser } = useAuth();
  const [preferences, setPreferences] = useState(
    user?.notificationPreferences || { inApp: true, email: true },
  );

  const categoryPreferences = {
    appointmentUpdates: preferences.appointmentUpdates || {
      inApp: true,
      email: true,
    },
    reminders: preferences.reminders || { inApp: true, email: true },
    system: preferences.system || { inApp: true, email: true },
  };

  useEffect(() => {
    getCalendarStatus()
      .then((response) => setCalendar(response.data))
      .catch((requestError) => setError(getApiErrorMessage(requestError)));
  }, []);

  useEffect(() => {
    const result = searchParams.get("calendar");
    if (result === "connected") showSuccess("Google Calendar connected.");
    if (result === "error")
      showError("Google Calendar could not be connected. Try again.");
  }, [searchParams]);

  async function disconnect() {
    const request = disconnectCalendar();
    showPromise(request, {
      loading: "Disconnecting Google Calendar...",
      success: "Google Calendar disconnected.",
      error: "Couldn't disconnect Google Calendar.",
    });
    try {
      await request;
      setCalendar({ connected: false, email: "" });
    } catch (requestError) {
      setError(getToastError(requestError));
    }
  }

  async function savePreference(key, value) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    try {
      const response = await updateNotificationPreferences(next);
      setUser(response.data.user);
    } catch (requestError) {
      setPreferences(preferences);
      showError(getToastError(requestError, "Unable to update notifications."));
    }
  }

  async function saveCategoryPreference(category, key, value) {
    const next = {
      ...preferences,
      [category]: { ...categoryPreferences[category], [key]: value },
    };
    setPreferences(next);
    try {
      const response = await updateNotificationPreferences(next);
      setUser(response.data.user);
    } catch (requestError) {
      setPreferences(preferences);
      showError(getToastError(requestError, "Unable to update notifications."));
    }
  }

  return (
    <main className="dashboard-content">
      <section className="dashboard-section patient-page-section settings-page">
        <div className="section-title-row">
          <div>
            <p className="dashboard-eyebrow">Your account</p>
            <h1>Settings</h1>
          </div>
        </div>
        {error && (
          <p className="profile-error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-list">
          <article className="settings-row">
            <span className="settings-icon">
              <LockKeyhole size={18} />
            </span>
            <div>
              <strong>Change password</strong>
              <p>Update the password you use to sign in.</p>
            </div>
            <button type="button">Change</button>
          </article>
          <article className="settings-row">
            <span className="settings-icon">
              <Bell size={18} />
            </span>
            <div>
              <strong>Notifications</strong>
              <p>Choose how AbsoluteCare keeps you informed.</p>
            </div>
            <div className="settings-preferences">
              <strong>Appointment updates</strong>
              <label>
                <input
                  type="checkbox"
                  checked={categoryPreferences.appointmentUpdates.inApp}
                  onChange={(event) =>
                    saveCategoryPreference(
                      "appointmentUpdates",
                      "inApp",
                      event.target.checked,
                    )
                  }
                />{" "}
                In-app
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={categoryPreferences.appointmentUpdates.email}
                  onChange={(event) =>
                    saveCategoryPreference(
                      "appointmentUpdates",
                      "email",
                      event.target.checked,
                    )
                  }
                />{" "}
                Email
              </label>
              <strong>Reminders</strong>
              <label>
                <input
                  type="checkbox"
                  checked={categoryPreferences.reminders.inApp}
                  onChange={(event) =>
                    saveCategoryPreference(
                      "reminders",
                      "inApp",
                      event.target.checked,
                    )
                  }
                />{" "}
                In-app
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={categoryPreferences.reminders.email}
                  onChange={(event) =>
                    saveCategoryPreference(
                      "reminders",
                      "email",
                      event.target.checked,
                    )
                  }
                />{" "}
                Email
              </label>
              <strong>System</strong>
              <label>
                <input
                  type="checkbox"
                  checked={categoryPreferences.system.inApp}
                  onChange={(event) =>
                    saveCategoryPreference(
                      "system",
                      "inApp",
                      event.target.checked,
                    )
                  }
                />{" "}
                In-app
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={categoryPreferences.system.email}
                  onChange={(event) =>
                    saveCategoryPreference(
                      "system",
                      "email",
                      event.target.checked,
                    )
                  }
                />{" "}
                Email
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.inApp}
                  onChange={(event) =>
                    savePreference("inApp", event.target.checked)
                  }
                />{" "}
                In-app
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={preferences.email}
                  onChange={(event) =>
                    savePreference("email", event.target.checked)
                  }
                />{" "}
                Email
              </label>
            </div>
          </article>
          <article className="settings-row">
            <span className="settings-icon">
              <CalendarDays size={18} />
            </span>
            <div>
              <strong>Google Calendar</strong>
              <p>
                Sync confirmed AbsoluteCare appointments to your calendar.
                Pending requests are never synced.
              </p>
              {calendar.connected && (
                <small>
                  Connected{calendar.email ? ` · ${calendar.email}` : ""}
                </small>
              )}
            </div>
            {calendar.connected ? (
              <button type="button" onClick={disconnect}>
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.location.href = getCalendarConnectUrl();
                }}
              >
                Connect
              </button>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}

export default SettingsPage;
