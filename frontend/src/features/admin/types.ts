export type PersonRef = {
  _id?: string
  firstname?: string
  firstName?: string
  lastname?: string
  lastName?: string
  email?: string
  phone?: string
  profilePicture?: string | null
}

export type ParamRef = {
  _id?: string
  firstname?: string
  lastname?: string
}

export type ServiceRef = {
  _id?: string
  name?: string
  description?: string
  duration?: number
  fee?: number
  category?: string
}

import type { DayHours } from '@/lib/availability'

export type WorkingHours = { start?: string; end?: string }

export type AuditEntry = {
  action?: string
  at?: string
  by?: PersonRef | string
  details?: string
}

export type UserAccount = PersonRef & {
  _id: string
  role?: string
  isActive?: boolean
  isArchived?: boolean
  removedAt?: string | null
  dateOfBirth?: string
  address?: string
  specialization?: string[] | string
  workingDays?: string[]
  workingHours?: WorkingHours
  workingHoursByDay?: DayHours[]
  accountAudit?: AuditEntry[]
}

export type PaymentRef = {
  status?: 'paid' | 'unpaid'
  amount?: number
  method?: 'cash' | 'gcash' | 'card' | 'other' | string
  referenceNumber?: string
  notes?: string
  reason?: string
  recordedBy?: PersonRef | string | null
  recordedAt?: string | null
  history?: AuditEntry[]
}

export type RescheduleRequest = {
  status?: string
  requestedBy?: string
  proposedDate?: string
  proposedTime?: string
  reason?: string
}

export type AdminAppointment = {
  _id: string
  status: string
  patient?: PersonRef | null
  dependent?: ParamRef | null
  therapist?: PersonRef | null
  service?: ServiceRef | null
  serviceSnapshot?: ServiceRef | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
  requestedDate?: string
  requestedTime?: string
  notes?: string
  createdAt?: string
  payment?: PaymentRef | null
  paymentAudit?: AuditEntry[]
  rescheduleRequest?: RescheduleRequest | null
}

export type SessionRecord = {
  _id: string
  sessionDate?: string
  durationMinutes?: number
  patientVisibleNotes?: string
  clinicalNotes?: string
  patient?: PersonRef | null
  therapist?: PersonRef | null
  service?: ServiceRef | null
}

export type AdminService = ServiceRef & {
  _id: string
  isActive?: boolean
}

export type Pagination = { page: number; limit: number; total: number; pages: number }

export type UserListFilters = {
  role?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}

export type AppointmentFilters = {
  tab?: string
  status?: string
  search?: string
  therapist?: string
  service?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type SessionFilters = {
  from?: string
  to?: string
  service?: string
}

export type PaymentFilters = {
  status?: string
  search?: string
  from?: string
  to?: string
}

export type StatusCount = { _id?: string; count?: number; duration?: number }
export type WorkloadRow = { name?: string; assigned?: number; completed?: number }
export type MethodTotal = { _id?: string; total?: number; count?: number }

export type TrendPoint = {
  date: string
  requests: number
  appointments: number
  patients: number
  outstanding: number
}

export type Reports = {
  range?: { from?: string; to?: string }
  patients?: { total?: number; new?: number; withSessions?: number }
  appointments?: { total?: number; byStatus?: StatusCount[]; completionRate?: number }
  sessions?: StatusCount[]
  therapistWorkload?: WorkloadRow[]
  payments?: {
    byMethod?: MethodTotal[]
    revenue?: number
    unpaid?: { total?: number; count?: number }
  }
  topTherapist?: { name?: string } | null
  trend?: TrendPoint[]
}

export type TherapistOption = { _id: string; firstname?: string; lastname?: string }
