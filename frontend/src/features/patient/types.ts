import type { SessionUser } from '@/features/auth/session'

export type TherapistRef = {
  _id?: string
  firstname?: string
  firstName?: string
  lastname?: string
  lastName?: string
  specialization?: string
  profilePicture?: string
}

export type ServiceRef = {
  _id?: string
  name?: string
  description?: string
  duration?: number
  fee?: number
}

export type RescheduleRequest = {
  status?: 'none' | 'requested' | 'approved' | 'declined'
  proposedDate?: string
  proposedTime?: string
  reason?: string
}

export type Appointment = {
  _id: string
  status: string
  service?: ServiceRef | null
  serviceSnapshot?: ServiceRef | null
  therapist?: TherapistRef | null
  dependent?: { _id?: string } | null
  requestedDate?: string
  requestedTime?: string
  scheduledStart?: string | null
  scheduledEnd?: string | null
  rescheduleRequest?: RescheduleRequest | null
  googleEventLink?: string
  notes?: string
  payment?: { status?: string; amount?: number; method?: string } | null
}

export type Dependent = {
  _id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  relationship: string
  sex?: string
  medicalNotes?: string
  nextAppointment?: Appointment | null
}

export type DependentDetail = {
  dependent: Dependent
  appointments: Appointment[]
  sessions: SessionRecord[]
}

export type TherapyService = {
  _id: string
  name: string
  description?: string
  duration?: number
  fee?: number
}

export type SessionRecord = {
  _id: string
  sessionDate: string
  durationMinutes?: number
  patientVisibleNotes?: string
  service?: ServiceRef | null
  therapist?: TherapistRef | null
}

export type PatientProfile = SessionUser & {
  phone?: string
  dateOfBirth?: string
  address?: string
  authProvider?: string
  isGuardian?: boolean
  createdAt?: string
}

export type CalendarStatus = {
  connected: boolean
  email: string
  connectedAt?: string | null
}

export type NotificationPreferences = {
  inApp?: boolean
  email?: boolean
  appointmentUpdates?: { inApp?: boolean; email?: boolean }
  reminders?: { inApp?: boolean; email?: boolean }
  system?: { inApp?: boolean; email?: boolean }
}
