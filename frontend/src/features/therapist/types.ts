import type { DayHours } from '@/lib/availability'

export type TherapistRef = {
  _id?: string
  firstname?: string
  firstName?: string
  lastname?: string
  lastName?: string
  specialization?: string | string[]
  profilePicture?: string | null
}

export type ServiceRef = {
  _id?: string
  name?: string
  duration?: number
  fee?: number
}

export type PatientRef = {
  _id?: string
  firstname?: string
  firstName?: string
  lastname?: string
  lastName?: string
  email?: string
  phone?: string
  dateOfBirth?: string
  profilePicture?: string | null
}

export type DependentRef = {
  _id?: string
  firstname?: string
  firstName?: string
  lastname?: string
  lastName?: string
  relationship?: string
}

export type RescheduleRequest = {
  status?: 'none' | 'requested' | 'approved' | 'declined'
  proposedDate?: string
  proposedTime?: string
  reason?: string
  requestedBy?: 'patient' | 'therapist'
}

export type Appointment = {
  _id: string
  status: string
  patient?: PatientRef | null
  dependent?: DependentRef | null
  service?: ServiceRef | null
  serviceSnapshot?: ServiceRef | null
  therapist?: TherapistRef | null
  requestedDate?: string
  requestedTime?: string
  scheduledStart?: string | null
  scheduledEnd?: string | null
  rescheduleRequest?: RescheduleRequest | null
  payment?: { status?: string; amount?: number; method?: string } | null
  googleEventLink?: string
  notes?: string
}

export type PatientRecord = {
  patient: PatientRef & { _id: string }
  dependent?: DependentRef | null
  nextAppointment?: Appointment | null
  lastSessionDate?: string | null
}

export type SessionRecord = {
  _id: string
  sessionDate: string
  durationMinutes?: number
  patient?: PatientRef | null
  dependent?: DependentRef | null
  service?: ServiceRef | null
  therapist?: TherapistRef | null
  clinicalNotes?: string
  patientVisibleNotes?: string
}

export type TherapistProfile = {
  _id?: string
  firstname?: string
  lastname?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  profilePicture?: string | null
  specialization?: string | string[]
  workingDays?: string[]
  workingHours?: { start?: string; end?: string }
  workingHoursByDay?: DayHours[]
  authProvider?: string
}

export type CalendarStatus = {
  connected: boolean
  email: string
  connectedAt?: string | null
}
