import { KeyRound } from 'lucide-react'
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

      <InlineNote>
        Staff accounts always use email and password and can&#39;t be changed here.
      </InlineNote>
    </SettingsSection>
  )
}
