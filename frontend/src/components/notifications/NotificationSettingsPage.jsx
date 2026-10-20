import { Bell } from "lucide-react";
import { useState } from "react";
import PageHeader from "../dashboard/PageHeader";
import { useAuth } from "../../context/useAuth";
import { updateNotificationPreferences } from "../../services/api/authApi";
import { getToastError, showError, showSuccess } from "../../utils/toast";

const categories = [
  [
    "appointmentUpdates",
    "Appointment updates",
    "Requests, confirmations, cancellations, and reschedules.",
  ],
  [
    "reminders",
    "Appointment reminders",
    "Keep reminders on to avoid missing a visit.",
  ],
  ["system", "System and account", "Important account and clinic updates."],
];

export default function NotificationSettingsPage() {
  const { user, setUser } = useAuth();
  const [preferences, setPreferences] = useState(
    user?.notificationPreferences || { inApp: true, email: true },
  );

  async function update(category, channel, value) {
    const next = {
      ...preferences,
      [category]: {
        ...(preferences[category] || { inApp: true, email: true }),
        [channel]: value,
      },
    };
    setPreferences(next);
    try {
      const response = await updateNotificationPreferences(next);
      setUser(response.data.user);
      showSuccess("Notification preferences saved.");
    } catch (error) {
      setPreferences(preferences);
      showError(
        getToastError(error, "Unable to update notification preferences."),
      );
    }
  }

  return (
    <main className="staff-dashboard-content">
      <PageHeader
        eyebrow="YOUR ACCOUNT"
        title="Notification settings"
        description="Choose which updates appear in your inbox and email."
      />
      <section className="notification-settings-card">
        <div className="notification-settings-global">
          <Bell size={18} />
          <div>
            <strong>Delivery channels</strong>
            <p>
              These defaults apply when a category does not have a specific
              setting.
            </p>
          </div>
        </div>
        {categories.map(([key, label, description]) => {
          const value = preferences[key] || { inApp: true, email: true };
          return (
            <article className="notification-settings-row" key={key}>
              <div>
                <strong>{label}</strong>
                <p>{description}</p>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={value.inApp !== false}
                  onChange={(event) =>
                    update(key, "inApp", event.target.checked)
                  }
                />{" "}
                In-app
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={value.email !== false}
                  onChange={(event) =>
                    update(key, "email", event.target.checked)
                  }
                />{" "}
                Email
              </label>
            </article>
          );
        })}
      </section>
    </main>
  );
}
