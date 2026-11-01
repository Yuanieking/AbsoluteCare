import axiosInstance from '@/lib/api/client'
import type {
  Appointment,
  CalendarStatus,
  Dependent,
  DependentDetail,
  PatientProfile,
  SessionRecord,
  TherapyService,
} from './types'

export type TherapyServiceList = { services: TherapyService[] }
export type AppointmentPage = {
  appointments: Appointment[]
  page: number
  limit: number
  total: number
}
export type DependentInput = {
  firstName: string
  lastName: string
  dateOfBirth: string
  relationship: string
  medicalNotes?: string
  sex?: string
}
export type BookingInput = {
  service: string
  requestedDate: string
  requestedTime: string
  dependent?: string | null
  notes?: string
}
export type RescheduleInput = { proposedDate: string; proposedTime: string; reason?: string }
export type ProfileInput = {
  firstName: string
  lastName: string
  phone?: string
  dateOfBirth?: string | null
  address?: string
  profilePicture?: string
}

export async function getProfile() {
  const response = await axiosInstance.get('/auth/me')
  return (response.data?.user || response.data) as PatientProfile
}

export async function updateProfile(payload: ProfileInput) {
  const response = await axiosInstance.patch('/auth/profile', payload)
  return (response.data?.user || response.data) as PatientProfile
}

export async function listServices() {
  const response = await axiosInstance.get('/services')
  return (response.data?.services || []) as TherapyService[]
}

export async function listDependents() {
  const response = await axiosInstance.get('/dependents')
  return (response.data?.dependents || []) as Dependent[]
}

export async function getDependent(id: string) {
  const response = await axiosInstance.get(`/dependents/${id}`)
  return response.data as DependentDetail
}

export async function createDependent(payload: DependentInput) {
  const response = await axiosInstance.post('/dependents', payload)
  return response.data?.dependent as Dependent
}

export async function updateDependent(id: string, payload: DependentInput) {
  const response = await axiosInstance.patch(`/dependents/${id}`, payload)
  return response.data?.dependent as Dependent
}

export async function removeDependent(id: string) {
  await axiosInstance.delete(`/dependents/${id}`)
}

export async function bookAppointment(payload: BookingInput) {
  const response = await axiosInstance.post('/appointments', payload)
  return response.data?.appointment as Appointment
}

export async function listAppointments(status: string, page = 1) {
  const response = await axiosInstance.get('/appointments', { params: { status, page } })
  return {
    appointments: (response.data?.appointments || []) as Appointment[],
    total: Number(response.data?.total || 0),
  }
}

export async function getAppointment(id: string) {
  const response = await axiosInstance.get(`/appointments/${id}`)
  return (response.data?.appointment || null) as Appointment | null
}

export async function requestReschedule(id: string, payload: RescheduleInput) {
  const response = await axiosInstance.post(`/appointments/${id}/reschedule-request`, payload)
  return (response.data?.appointment || null) as Appointment | null
}

export async function cancelAppointment(id: string, reason?: string) {
  const response = await axiosInstance.post(`/appointments/${id}/cancel`, { reason })
  return (response.data?.appointment || null) as Appointment | null
}

export async function syncAppointmentCalendar(id: string) {
  const response = await axiosInstance.post(`/appointments/${id}/calendar-sync`)
  return response.data as { googleEventId?: string; googleEventLink?: string }
}

export async function listSessions() {
  const response = await axiosInstance.get('/sessions')
  return (response.data?.sessions || []) as SessionRecord[]
}

export async function getSession(id: string) {
  const response = await axiosInstance.get(`/sessions/${id}`)
  return (response.data?.session || null) as SessionRecord | null
}

export async function getCalendarStatus() {
  const response = await axiosInstance.get('/integrations/google-calendar/status')
  return response.data as CalendarStatus
}

export async function disconnectCalendar() {
  await axiosInstance.post('/integrations/google-calendar/disconnect')
}

export function getCalendarConnectUrl() {
  return `${axiosInstance.defaults.baseURL}/integrations/google-calendar/connect`
}
