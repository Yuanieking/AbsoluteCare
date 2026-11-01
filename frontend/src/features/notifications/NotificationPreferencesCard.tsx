import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/features/auth/session'
import { updateNotificationPreferences, type AuthUser } from '@/lib/api/auth'
import { getToastError, showError } from '@/lib/toast'

type ChannelPreferences = { inApp?: boolean; email?: boolean }

export type NotificationPreferences = ChannelPreferences & {
  appointmentUpdates?: ChannelPreferences
  reminders?: ChannelPreferences
  system?: ChannelPreferences
}

type Channel = 'inApp' | 'email'

const categories: {
  key: 'appointmentUpdates' | 'reminders' | 'system'
  label: string
  description: string
}[] = [
  {
    key: 'appointmentUpdates',
    label: 'Appointment updates',
    description: 'Requests, confirmations, cancellations and reschedules.',
  },
  {
    key: 'reminders',
    label: 'Appointment reminders',
    description: 'Keep reminders on to avoid missing a visit.',
  },
  {
    key: 'system',
    label: 'System and account',
    description: 'Important account and clinic updates.',
  },
]

export function NotificationPreferencesCard() {
  const { user, setUser } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    (user?.notificationPreferences as NotificationPreferences | undefined) || {
      inApp: true,
      email: true,
    },
  )

  async function save(next: NotificationPreferences) {
    const previous = preferences
    setPreferences(next)
    try {
      const response = await updateNotificationPreferences(next)
      if (response.data?.user) setUser(response.data.user as AuthUser)
    } catch (error) {
      setPreferences(previous)
      showError(getToastError(error, 'Unable to update notification preferences.'))
    }
  }

  function toggleCategory(
    category: (typeof categories)[number]['key'],
    channel: Channel,
    value: boolean,
  ) {
    const current = preferences[category] || { inApp: true, email: true }
    void save({ ...preferences, [category]: { ...current, [channel]: value } })
  }

  return (
    <section className="rounded-lg border border-hairline bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-ink-faint" aria-hidden="true">
          <Bell size={18} />
        </span>
        <div>
          <strong className="text-[13.5px] text-ink">Notifications</strong>
          <p className="text-[12.5px] text-ink-soft">Choose how AbsoluteCare keeps you informed.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-hairline-in pt-4">
        {categories.map((category) => (
          <div key={category.key} className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="min-w-44">
              <strong className="block text-[12.5px] text-ink">{category.label}</strong>
              <span className="text-[11.5px] text-ink-faint">{category.description}</span>
            </div>
            <ChannelToggle
              label="In-app"
              checked={preferences[category.key]?.inApp !== false}
              onChange={(value) => toggleCategory(category.key, 'inApp', value)}
            />
            <ChannelToggle
              label="Email"
              checked={preferences[category.key]?.email !== false}
              onChange={(value) => toggleCategory(category.key, 'email', value)}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline-in pt-3">
          <strong className="min-w-44 text-[12.5px] text-ink">Default channels</strong>
          <ChannelToggle
            label="In-app"
            checked={preferences.inApp !== false}
            onChange={(value) => void save({ ...preferences, inApp: value })}
          />
          <ChannelToggle
            label="Email"
            checked={preferences.email !== false}
            onChange={(value) => void save({ ...preferences, email: value })}
          />
        </div>
      </div>
    </section>
  )
}

function ChannelToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  )
}
