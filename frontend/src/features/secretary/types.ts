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

export type DependentRef = {
  _id?: string
  firstName?: string
  firstname?: string
  lastName?: string
  lastname?: string
  relationship?: string
}

export type ServiceRef = {
  _id?: string
  name?: string
  duration?: number
  fee?: number
}

export type PaymentHistoryEntry = {
  action?: string
  by?: string | null
  details?: string
  at?: string | null
}

export type PaymentRef = {
  status?: 'paid' | 'unpaid'
  amount?: number
  method?: 'cash' | 'gcash' | 'card' | 'other'
  referenceNumber?: string
  notes?: string
  recordedBy?: string | null
  recordedAt?: string | null
  history?: PaymentHistoryEntry[]
}

export type SecretaryAppointment = {
  _id: string
  status: string
  patient?: PersonRef | null
  dependent?: DependentRef | null
  therapist?: PersonRef | null
  service?: ServiceRef | null
  serviceSnapshot?: ServiceRef | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
  requestedDate?: string
  requestedTime?: string
  cancelReason?: string
  payment?: PaymentRef | null
}

export type TherapistOption = { _id: string; firstname?: string; lastname?: string }

export type SecretaryProfile = {
  _id?: string
  firstname?: string
  lastname?: string
  email?: string
  phone?: string
  profilePicture?: string | null
  role?: string
  isActive?: boolean
}
