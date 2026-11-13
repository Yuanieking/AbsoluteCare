import { KeyRound, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { sectionMap } from '../config'
import {
  InlineNote,
  NumberInput,
  SelectInput,
  SettingRow,
  SettingsCard,
  SettingsSection,
  SwitchRow,
  TextInput,
} from '../fields'
import type { AuthValues } from '../types'

function FixedAccess() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft">
      <Lock size={13} aria-hidden="true" />
      Always on
    </span>
  )
}

export function AuthSection({
  value,
  update,
}: {
  value: AuthValues
  update: (field: keyof AuthValues, next: boolean | number | string) => void
}) {
  return (
    <SettingsSection section={sectionMap.auth!}>
      <SettingsCard
        title="Patient access"
        description="Control how patients create and verify accounts."
      >
        <SettingRow
          label="Patient self-registration"
          helper="Allow new patients to create their own account."
        >
          <SwitchRow
            label="Patient self-registration"
            checked={value.patientRegistrationEnabled}
            onChange={(next) => update('patientRegistrationEnabled', next)}
          />
        </SettingRow>
        <SettingRow
          label="Require email verification"
          helper="Ask new patients to verify their email address."
        >
          <SwitchRow
            label="Require email verification"
            checked={value.emailVerificationRequired}
            onChange={(next) => update('emailVerificationRequired', next)}
          />
        </SettingRow>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-[12px] text-ink-soft">
          <KeyRound size={15} aria-hidden="true" />
          <span className="flex-1">
            Sign-in providers and bot protection are managed in Integrations.
          </span>
          <Link
            to="/staff/admin/settings?section=integrations"
            className="font-medium text-primary hover:underline"
          >
            Open Integrations
          </Link>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Password and sessions"
        description="Set the minimum password and session protection rules."
      >
        <SettingRow
          label="Password minimum length"
          helper={`A valid password has at least ${value.passwordMinLength} characters.`}
        >
          <NumberInput
            ariaLabel="Password minimum length"
            unit="characters"
            min={8}
            max={32}
            value={value.passwordMinLength}
            onChange={(next) => update('passwordMinLength', next)}
          />
        </SettingRow>
        <SettingRow label="Session timeout" helper="Staff accounts always use email and password.">
          <SelectInput
            ariaLabel="Session timeout"
            value={String(value.sessionTimeoutMinutes)}
            onChange={(next) => update('sessionTimeoutMinutes', Number(next))}
            options={[
              { value: '15', label: '15 minutes' },
              { value: '30', label: '30 minutes' },
              { value: '60', label: '1 hour' },
              { value: '480', label: '8 hours' },
              { value: '1440', label: '24 hours' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Max login attempts" helper="Attempts before temporary lockout.">
          <NumberInput
            ariaLabel="Max login attempts"
            unit="attempts"
            min={3}
            max={10}
            value={value.maxLoginAttempts}
            onChange={(next) => update('maxLoginAttempts', next)}
          />
        </SettingRow>
        <SettingRow label="Lockout duration" helper="How long a locked account must wait.">
          <NumberInput
            ariaLabel="Lockout duration"
            unit="minutes"
            min={1}
            max={1440}
            value={value.lockoutMinutes}
            onChange={(next) => update('lockoutMinutes', next)}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Terms"
        description="Require patients to accept the latest terms again when this changes."
      >
        <SettingRow label="Current version" helper="Bump this value to request re-acceptance.">
          <TextInput
            ariaLabel="Terms version"
            value={value.termsVersion}
            onChange={(next) => update('termsVersion', next)}
            className="w-32"
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Roles and permissions"
        description="Role-based access control (RBAC) is active. Choose which shared areas each staff role can open. The server enforces this on every request."
        footer="Roles are assigned in Users. Save to apply changes."
      >
        <SettingRow
          label="Admin"
          helper="Full access to every area. Locked so the clinic can't lose its own admin access."
        >
          <FixedAccess />
        </SettingRow>
        <SettingRow
          label="Secretary: Documents"
          helper="Generate, view, and download clinic documents. The front desk, schedule, and payments are always available."
        >
          <SwitchRow
            label="Secretary can open Documents"
            checked={value.secretaryCanOpenDocuments}
            onChange={(next) => update('secretaryCanOpenDocuments', next)}
          />
        </SettingRow>
        <SettingRow
          label="Secretary: Google Drive status"
          helper="See whether the clinic Google Drive is connected. Connecting and disconnecting stays admin only."
        >
          <SwitchRow
            label="Secretary can view Google Drive status"
            checked={value.secretaryCanViewDriveStatus}
            onChange={(next) => update('secretaryCanViewDriveStatus', next)}
          />
        </SettingRow>
        <SettingRow
          label="Therapist: Documents"
          helper="Generate, view, and download clinic documents. Appointments, availability, and session records are always available."
        >
          <SwitchRow
            label="Therapist can open Documents"
            checked={value.therapistCanOpenDocuments}
            onChange={(next) => update('therapistCanOpenDocuments', next)}
          />
        </SettingRow>
        <SettingRow
          label="Patient"
          helper="Own dependents, appointments, sessions, and notifications only."
        >
          <FixedAccess />
        </SettingRow>
      </SettingsCard>

      <InlineNote>
        Staff accounts always use email and password and can&#39;t be changed here.
      </InlineNote>
    </SettingsSection>
  )
}
