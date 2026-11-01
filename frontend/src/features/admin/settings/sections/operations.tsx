import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sectionMap } from '../config'
import {
  ChipGroup,
  InlineNote,
  SelectInput,
  SettingRow,
  SettingsCard,
  SettingsSection,
  SwitchRow,
  TextInput,
} from '../fields'
import type { MaintenanceValues, NotificationsValues, PaymentsValues } from '../types'

export function NotificationsSection({
  value,
  update,
  onTestEmail,
}: {
  value: NotificationsValues
  update: (field: keyof NotificationsValues, next: boolean | string | number[]) => void
  onTestEmail: () => void
}) {
  return (
    <SettingsSection section={sectionMap.notifications!}>
      <SettingsCard title="Channels" description="Choose where clinic messages are delivered.">
        <SettingRow label="Email notifications" helper="Send appointment and account emails.">
          <SwitchRow
            label="Email notifications"
            checked={value.emailEnabled}
            onChange={(next) => update('emailEnabled', next)}
          />
        </SettingRow>
        <SettingRow
          label="In-app notifications"
          helper="Show updates in the patient and staff portals."
        >
          <SwitchRow
            label="In-app notifications"
            checked={value.inAppEnabled}
            onChange={(next) => update('inAppEnabled', next)}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Reminders" description="Choose when appointment reminders are sent.">
        <SettingRow
          label="Send reminders"
          helper="Reminder notifications can be changed without affecting bookings."
        >
          <SwitchRow
            label="Send reminders"
            checked={value.remindersEnabled}
            onChange={(next) => update('remindersEnabled', next)}
          />
        </SettingRow>
        <SettingRow label="Lead time" helper="At least one reminder time is required.">
          <ChipGroup
            ariaLabel="Reminder lead times"
            options={['24h', '12h', '2h', '1h']}
            value={(value.reminderLeadHours ?? []).map((hour) => `${hour}h`)}
            onChange={(next) =>
              update(
                'reminderLeadHours',
                next.map((hour) => Number.parseInt(hour, 10)),
              )
            }
          />
        </SettingRow>
        <SettingRow label="Sender name" helper="Shown in notification emails.">
          <TextInput
            ariaLabel="Sender name"
            value={value.senderName}
            onChange={(next) => update('senderName', next)}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Test">
        <SettingRow
          label="Send a test email"
          helper="Sent to TEST_EMAIL_RECIPIENT from backend/.env, or your admin email when that isn't set."
        >
          <Button type="button" variant="outline" size="sm" onClick={onTestEmail}>
            <Mail size={15} aria-hidden="true" /> Send test email
          </Button>
        </SettingRow>
      </SettingsCard>
    </SettingsSection>
  )
}

export function PaymentsSection({
  value,
  update,
}: {
  value: PaymentsValues
  update: (field: keyof PaymentsValues, next: boolean | string[]) => void
}) {
  return (
    <SettingsSection section={sectionMap.payments!}>
      <SettingsCard
        title="Payment methods"
        description="At least one payment method must remain enabled."
      >
        <SettingRow
          label="Enabled methods"
          helper="These methods appear when staff record a payment."
        >
          <ChipGroup
            ariaLabel="Enabled payment methods"
            options={['Cash', 'GCash', 'Card', 'Other']}
            value={value.enabledMethods ?? []}
            onChange={(next) => update('enabledMethods', next)}
          />
        </SettingRow>
        <SettingRow
          label="Reference for non-cash"
          helper="Require a reference number for GCash, card, or other payments."
        >
          <SwitchRow
            label="Reference for non-cash"
            checked={value.requireReferenceForNonCash}
            onChange={(next) => update('requireReferenceForNonCash', next)}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Currency">
        <SettingRow label="Clinic currency" helper="Fixed for this clinic.">
          <span className="text-[13px] text-ink">₱ PHP</span>
        </SettingRow>
      </SettingsCard>
    </SettingsSection>
  )
}

export function MaintenanceSection({
  value,
  update,
}: {
  value: MaintenanceValues
  update: (
    field: keyof MaintenanceValues,
    next: boolean | string | { enabled: boolean; message: string; type: string },
  ) => void
}) {
  const announcement = value.announcement ?? { enabled: false, message: '', type: 'info' }

  return (
    <SettingsSection section={sectionMap.system!}>
      <SettingsCard
        className="border-destructive/25"
        title="Maintenance mode"
        description="Patients see the message while staff keep full access."
      >
        <SettingRow
          label="Maintenance mode"
          helper="Use this while the clinic app is unavailable to patients."
        >
          <SwitchRow
            label="Maintenance mode"
            checked={value.maintenanceMode}
            onChange={(next) => update('maintenanceMode', next)}
          />
        </SettingRow>
        <SettingRow label="Patient message" helper="Shown on the patient maintenance screen.">
          <TextInput
            ariaLabel="Maintenance message"
            value={value.maintenanceMessage}
            onChange={(next) => update('maintenanceMessage', next)}
          />
        </SettingRow>
        <InlineNote tone="danger">
          Patients can&#39;t book or log in during maintenance. Staff can still access the portal.
        </InlineNote>
        <div className="mx-5 mb-4 rounded-md border border-hairline bg-sunk px-3 py-2">
          <span className="block text-[11.5px] text-ink-faint">Patient preview</span>
          <strong className="mt-0.5 block text-[13px] text-ink">{value.maintenanceMessage}</strong>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Announcement banner"
        description="Show a short message at the top of the patient portal."
      >
        <SettingRow
          label="Announcement enabled"
          helper="Patients see this banner until it expires."
        >
          <SwitchRow
            label="Announcement enabled"
            checked={announcement.enabled}
            onChange={(next) => update('announcement', { ...announcement, enabled: next })}
          />
        </SettingRow>
        <SettingRow label="Message" helper="Keep the message concise and useful.">
          <TextInput
            ariaLabel="Announcement message"
            value={announcement.message}
            onChange={(next) => update('announcement', { ...announcement, message: next })}
          />
        </SettingRow>
        <SettingRow label="Type" helper="Choose the tone of the announcement.">
          <SelectInput
            ariaLabel="Announcement type"
            value={announcement.type || 'info'}
            onChange={(next) => update('announcement', { ...announcement, type: next })}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
            ]}
          />
        </SettingRow>
      </SettingsCard>
    </SettingsSection>
  )
}
