import { PageBody, PageHeader } from '@/components/layout/Page'
import { NotificationPreferencesCard } from '@/features/notifications/NotificationPreferencesCard'

export default function TherapistSettingsPage() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Your account"
        title="Notification settings"
        description="Choose which updates appear in your inbox and email."
      />
      <div className="mt-5">
        <NotificationPreferencesCard />
      </div>
    </PageBody>
  )
}
