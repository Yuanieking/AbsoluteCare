export type GeneralValues = {
  clinicName: string
  phone: string
  email: string
  address: string
  timezone: string
  currency: string
}

export type ScheduleValues = {
  openDays: string[]
  openHours: { start: string; end: string }
}

export type BookingValues = {
  onlineBookingEnabled: boolean
  minNoticeHours: number
  maxAdvanceDays: number
  slotIntervalMinutes: number
  maxPendingRequestsPerPatient: number
  allowDependents: boolean
  patientCanCancel: boolean
  patientCancelCutoffHours: number
  rescheduleCutoffHours: number
}

export type AuthValues = {
  patientRegistrationEnabled: boolean
  emailVerificationRequired: boolean
  passwordMinLength: number
  sessionTimeoutMinutes: number
  maxLoginAttempts: number
  lockoutMinutes: number
  termsVersion: string
}

export type NotificationsValues = {
  emailEnabled: boolean
  inAppEnabled: boolean
  remindersEnabled: boolean
  reminderLeadHours: number[]
  senderName: string
}

export type PaymentsValues = {
  enabledMethods: string[]
  requireReferenceForNonCash: boolean
}

export type MaintenanceValues = {
  maintenanceMode: boolean
  maintenanceMessage: string
  announcement: { enabled: boolean; message: string; type: string }
}

export type IntegrationValues = {
  googleAuthEnabled: boolean
  recaptchaEnabled: boolean
  googleCalendarEnabled: boolean
  emailEnabled: boolean
}

export type AdminSettings = {
  general: GeneralValues
  schedule: ScheduleValues
  booking: BookingValues
  auth: AuthValues
  notifications: NotificationsValues
  payments: PaymentsValues
  system: MaintenanceValues
  integrations: IntegrationValues
}

export type SettingsSectionKey = keyof AdminSettings

export type IntegrationFlags = Partial<
  Record<'google' | 'recaptcha' | 'email' | 'googleCalendar', boolean>
>

export type IntegrationHealthRecord = {
  configured?: boolean
  effectiveEnabled?: boolean
  missing?: string[]
  details?: Record<string, string | undefined>
  updatedAt?: string
  updatedBy?: { name?: string }
  ok?: boolean
  lastTest?: { ok?: boolean; checkedAt?: string; message?: string }
}

export type IntegrationHealth = {
  google?: IntegrationHealthRecord
  recaptcha?: IntegrationHealthRecord
  calendar?: IntegrationHealthRecord
  email?: IntegrationHealthRecord
}

export type CredentialKeyEntry = {
  key: string
  label: string
  kind?: string
  required?: boolean
  source?: 'app' | 'env' | string
  masked?: string
  helper?: string
  helpUrl?: string
  hasPrevious?: boolean
  loadBearing?: boolean
  updatedAt?: string
  updatedBy?: { name?: string }
  verified?: boolean
  stale?: boolean
  sharedWith?: string
}

export type CredentialGroup = {
  id: string
  title: string
  purpose: string
  keys: CredentialKeyEntry[]
  status: { configured: boolean; stale?: boolean; missing: string[] }
  connectedAccounts?: number
  helpUrl?: string
  redirectUri?: string
}

export type RestartState = {
  required?: boolean
  supported?: boolean
  command?: string
}

export type CredentialsResponse = {
  groups?: CredentialGroup[]
  unmanaged?: { key: string; present: boolean }[]
  mail?: { adminEmail?: boolean }
  restart?: RestartState
  warnings?: string[]
}

export type AuditEntry = {
  _id: string
  createdAt?: string
  admin?: { firstname?: string; lastname?: string }
  section?: string
  field?: string
  oldValue?: unknown
  newValue?: unknown
}
