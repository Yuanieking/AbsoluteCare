import { Globe2 } from 'lucide-react'
import { AddressInput } from '@/components/form/AddressInput'
import { sectionMap } from '../config'
import {
  ChipGroup,
  InlineNote,
  NumberInput,
  SelectInput,
  SettingRow,
  SettingsCard,
  SettingsSection,
  SwitchRow,
  TextInput,
} from '../fields'
import type { BookingValues, GeneralValues, ScheduleValues } from '../types'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function GeneralSection({
  value,
  update,
}: {
  value: GeneralValues
  update: (field: keyof GeneralValues, next: string) => void
}) {
  return (
    <SettingsSection section={sectionMap.general!}>
      <SettingsCard
        title="Clinic profile"
        description="Shown in patient-facing pages and email templates."
      >
        <SettingRow label="Clinic name" helper="The name patients see throughout the app.">
          <TextInput
            ariaLabel="Clinic name"
            value={value.clinicName}
            onChange={(next) => update('clinicName', next)}
          />
        </SettingRow>
        <SettingRow label="Phone" helper="The clinic number shown when booking is unavailable.">
          <TextInput
            ariaLabel="Clinic phone"
            type="tel"
            value={value.phone}
            onChange={(next) => update('phone', next)}
          />
        </SettingRow>
        <SettingRow label="Email" helper="The shared support email address.">
          <TextInput
            ariaLabel="Clinic email"
            type="email"
            value={value.email}
            onChange={(next) => update('email', next)}
          />
        </SettingRow>
        <SettingRow label="Address" helper="The clinic address used in contact details.">
          <AddressInput
            aria-label="Clinic address"
            wrapperClassName="w-72"
            className="h-9 text-[13px]"
            value={value.address}
            onChange={(next) => update('address', next)}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Regional"
        description="Fixed values used by the clinic."
        footer={
          <span className="inline-flex items-center gap-1.5">
            <Globe2 size={14} aria-hidden="true" /> Fixed for this clinic
          </span>
        }
      >
        <SettingRow label="Timezone" helper="All appointment times use this timezone.">
          <span className="text-[13px] text-ink">{value.timezone}</span>
        </SettingRow>
        <SettingRow label="Currency" helper="Used for payment records and summaries.">
          <span className="text-[13px] text-ink">₱ {value.currency}</span>
        </SettingRow>
      </SettingsCard>
    </SettingsSection>
  )
}

export function ScheduleSection({
  value,
  update,
}: {
  value: ScheduleValues
  update: (field: keyof ScheduleValues, next: string[] | { start: string; end: string }) => void
}) {
  const openDays = value.openDays ?? []
  const hours = value.openHours ?? { start: '08:00', end: '17:00' }

  return (
    <SettingsSection section={sectionMap.schedule!}>
      <SettingsCard
        title="Opening hours"
        description="Choose open days and the regular clinic hours."
      >
        <SettingRow label="Open days" helper="Patients can only book on open days.">
          <ChipGroup
            ariaLabel="Open days"
            options={days}
            value={openDays}
            onChange={(next) => update('openDays', next)}
          />
        </SettingRow>
        <SettingRow label="Opening hours" helper="The regular clinic hours for open days.">
          <div className="flex items-center gap-2">
            <TextInput
              ariaLabel="Opening time"
              type="time"
              value={hours.start || '08:00'}
              onChange={(next) => update('openHours', { ...hours, start: next })}
              className="w-32"
            />
            <span className="text-[12px] text-ink-soft">to</span>
            <TextInput
              ariaLabel="Closing time"
              type="time"
              value={hours.end || '17:00'}
              onChange={(next) => update('openHours', { ...hours, end: next })}
              className="w-32"
            />
          </div>
        </SettingRow>
        <InlineNote>
          Holidays and exceptional clinic closures are managed by the clinic calendar; nothing else
          is configured here.
        </InlineNote>
      </SettingsCard>
    </SettingsSection>
  )
}

export function BookingSection({
  value,
  update,
}: {
  value: BookingValues
  update: (field: keyof BookingValues, next: boolean | number) => void
}) {
  const summary = `Patients can book between ${value.minNoticeHours} hours and ${value.maxAdvanceDays} days ahead, in ${value.slotIntervalMinutes}-minute slots.`

  return (
    <SettingsSection section={sectionMap.booking!}>
      <SettingsCard
        title="Online booking"
        description="Patients won't be able to request appointments when this is off."
      >
        <SettingRow
          label="Online booking"
          helper="The master switch for patient appointment requests."
        >
          <SwitchRow
            label="Online booking"
            checked={value.onlineBookingEnabled}
            onChange={(next) => update('onlineBookingEnabled', next)}
          />
        </SettingRow>
      </SettingsCard>

      <div className={value.onlineBookingEnabled ? undefined : 'opacity-60'}>
        <SettingsCard title="Booking rules" description={summary}>
          <SettingRow label="Minimum notice" helper="How soon before a slot patients may book.">
            <NumberInput
              ariaLabel="Minimum notice"
              unit="hours"
              min={0}
              max={720}
              value={value.minNoticeHours}
              onChange={(next) => update('minNoticeHours', next)}
            />
          </SettingRow>
          <SettingRow
            label="Maximum advance"
            helper="How far into the future booking is available."
          >
            <NumberInput
              ariaLabel="Maximum advance"
              unit="days"
              min={1}
              max={365}
              value={value.maxAdvanceDays}
              onChange={(next) => update('maxAdvanceDays', next)}
            />
          </SettingRow>
          <SettingRow label="Slot interval" helper="The interval used to generate available slots.">
            <SelectInput
              ariaLabel="Slot interval"
              value={String(value.slotIntervalMinutes)}
              onChange={(next) => update('slotIntervalMinutes', Number(next))}
              options={[
                { value: '15', label: '15 minutes' },
                { value: '30', label: '30 minutes' },
                { value: '60', label: '60 minutes' },
              ]}
            />
          </SettingRow>
          <SettingRow label="Pending request limit" helper="Maximum pending requests per patient.">
            <NumberInput
              ariaLabel="Pending request limit"
              unit="requests"
              min={1}
              max={20}
              value={value.maxPendingRequestsPerPatient}
              onChange={(next) => update('maxPendingRequestsPerPatient', next)}
            />
          </SettingRow>
          <SettingRow label="Allow dependents" helper="Let patients book for linked dependents.">
            <SwitchRow
              label="Allow dependents"
              checked={value.allowDependents}
              onChange={(next) => update('allowDependents', next)}
            />
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Changes and cancellations" className="mt-4">
          <SettingRow
            label="Patients can cancel"
            helper="Allow patients to cancel from the portal."
          >
            <SwitchRow
              label="Patients can cancel"
              checked={value.patientCanCancel}
              onChange={(next) => update('patientCanCancel', next)}
            />
          </SettingRow>
          <SettingRow label="Cancellation cutoff" helper="Minimum hours before an appointment.">
            <NumberInput
              ariaLabel="Cancellation cutoff"
              unit="hours"
              min={0}
              max={720}
              value={value.patientCancelCutoffHours}
              onChange={(next) => update('patientCancelCutoffHours', next)}
            />
          </SettingRow>
          <SettingRow label="Reschedule cutoff" helper="Minimum hours before an appointment.">
            <NumberInput
              ariaLabel="Reschedule cutoff"
              unit="hours"
              min={0}
              max={720}
              value={value.rescheduleCutoffHours}
              onChange={(next) => update('rescheduleCutoffHours', next)}
            />
          </SettingRow>
        </SettingsCard>
      </div>
    </SettingsSection>
  )
}
