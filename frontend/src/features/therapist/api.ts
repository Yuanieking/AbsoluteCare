import axiosInstance from '@/lib/api/client'
import type { DayHours } from '@/lib/availability'
import type {
  Appointment,
  CalendarStatus,
  PatientRecord,
  SessionRecord,
  TherapistProfile,
} from './types'

export type RescheduleInput = { proposedDate: string; proposedTime: string; reason: string }
export type SessionInput = {
  sessionDate: string
  durationMinutes: number
  patientVisibleNotes: string
  clinicalNotes: string
}
export type AvailabilityInput = {
  workingDays: string[]
  workingHoursByDay: DayHours[]
}
export type ProfileInput = {
  firstname: string
  lastname: string
  phone?: string
  address?: string
  profilePicture?: string
}

export async function getProfile() {
  const response = await axiosInstance.get('/therapist/profile')
  return response.data?.profile as TherapistProfile
}

export async function updateProfile(payload: ProfileInput) {
  const response = await axiosInstance.patch('/therapist/profile', payload)
  return response.data?.profile as TherapistProfile
}

export async function updateAvailability(payload: AvailabilityInput) {
  const response = await axiosInstance.patch('/therapist/availability', payload)
  return response.data?.profile as TherapistProfile
}

export async function listAppointments() {
  const response = await axiosInstance.get('/therapist/appointments')
  return (response.data?.appointments || []) as Appointment[]
}

export async function getAppointment(id: string) {
  const response = await axiosInstance.get(`/therapist/appointments/${id}`)
  return response.data?.appointment as Appointment
}

export async function requestReschedule(id: string, payload: RescheduleInput) {
  const response = await axiosInstance.post(
    `/therapist/appointments/${id}/reschedule-request`,
    payload,
  )
  return response.data?.appointment as Appointment
}

export async function markNoShow(id: string) {
  const response = await axiosInstance.patch(`/therapist/appointments/${id}/no-show`)
  return response.data?.appointment as Appointment
}

export async function createSession(id: string, payload: SessionInput) {
  const response = await axiosInstance.post(`/therapist/appointments/${id}/session`, payload)
  return response.data?.session as SessionRecord
}

export async function listPatients() {
  const response = await axiosInstance.get('/therapist/patients')
  return (response.data?.patients || []) as PatientRecord[]
}

export async function listSessions() {
  const response = await axiosInstance.get('/therapist/sessions')
  return (response.data?.sessions || []) as SessionRecord[]
}

export async function updateSession(id: string, payload: SessionInput) {
  const response = await axiosInstance.patch(`/therapist/sessions/${id}`, payload)
  return response.data?.session as SessionRecord
}

export async function getCalendarStatus() {
  const response = await axiosInstance.get('/integrations/google-calendar/therapist-status')
  return response.data as CalendarStatus
}

export async function disconnectCalendar() {
  await axiosInstance.post('/integrations/google-calendar/therapist-disconnect')
}

export function getCalendarConnectUrl() {
  return `${axiosInstance.defaults.baseURL}/integrations/google-calendar/therapist-connect`
}
