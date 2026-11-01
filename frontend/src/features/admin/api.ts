import axiosInstance from '@/lib/api/client'
import type { AuthUser } from '@/lib/api/auth'
import type { DayHours } from '@/lib/availability'
import type {
  AdminAppointment,
  AdminService,
  AppointmentFilters,
  Pagination,
  PaymentFilters,
  Reports,
  SessionFilters,
  SessionRecord,
  TherapistOption,
  UserAccount,
  UserListFilters,
} from './types'

export type UserInput = {
  firstname: string
  lastname: string
  email: string
  role: string
  phone: string
}

export type CreateUserInput = UserInput & { password?: string }

export type ProfileInput = {
  firstName: string
  lastName: string
  phone?: string
  address?: string
  profilePicture?: string
}

export type PaymentInput = {
  amount: number
  method: string
  referenceNumber: string
  notes: string
  reason?: string
}

export type PaymentUpdate = PaymentInput & { status: 'paid' | 'unpaid' }

export type ServiceInput = {
  name: string
  description: string
  duration: number
  fee: number
  category: string
}

export type AssignInput = { therapistId: string; note?: string }
export type RescheduleInput = { newDate: string; newTime: string; reason?: string }
export type CancelInput = { reason: string }
export type DeclineInput = { reason: string }
export type NotifyInput = { message: string }

async function listUsers(filters: UserListFilters) {
  const response = await axiosInstance.get('/admin/users', { params: filters })
  return {
    users: (response.data?.users || []) as UserAccount[],
    pagination: response.data?.pagination as Pagination | undefined,
  }
}

export async function createUser(payload: CreateUserInput) {
  const response = await axiosInstance.post('/admin/users', payload)
  return response.data as { user: UserAccount; temporaryPassword?: string }
}

export async function updateUser(id: string, payload: UserInput) {
  const response = await axiosInstance.patch(`/admin/users/${id}`, payload)
  return response.data?.user as UserAccount
}

export async function setUserActive(id: string, active: boolean) {
  const response = await axiosInstance.patch(
    `/admin/users/${id}/${active ? 'activate' : 'deactivate'}`,
  )
  return response.data?.user as UserAccount
}

export async function archiveUser(id: string) {
  const response = await axiosInstance.patch(`/admin/users/${id}/archive`)
  return response.data?.user as UserAccount
}

export async function removeUser(id: string, confirmName: string) {
  await axiosInstance.delete(`/admin/users/${id}`, { data: { confirmName } })
}

export const userApi = { listUsers, createUser, updateUser, setUserActive, archiveUser, removeUser }

export async function updatePatient(id: string, payload: Record<string, unknown>) {
  const response = await axiosInstance.patch(`/admin/patients/${id}`, payload)
  return response.data?.user as UserAccount
}

export async function updateTherapist(id: string, payload: Record<string, unknown>) {
  const response = await axiosInstance.patch(`/admin/therapists/${id}`, payload)
  return response.data?.user as UserAccount
}

export async function updateTherapistSpecialization(id: string, specialization: string[]) {
  await axiosInstance.patch(`/admin/therapists/${id}/specialization`, { specialization })
}

export type AvailabilityInput = {
  workingDays: string[]
  workingHoursByDay: DayHours[]
}

export async function updateTherapistAvailability(id: string, payload: AvailabilityInput) {
  const response = await axiosInstance.patch(`/admin/therapists/${id}/working-days`, payload)
  return response.data?.user as UserAccount
}

export async function listAppointments(filters: AppointmentFilters) {
  const response = await axiosInstance.get('/admin/appointments', { params: filters })
  return {
    appointments: (response.data?.appointments || []) as AdminAppointment[],
    pagination: (response.data?.pagination || { page: 1, pages: 1 }) as Pagination,
  }
}

export async function availableTherapists(id: string) {
  const response = await axiosInstance.get(`/admin/appointments/${id}/available-therapists`)
  return (response.data?.therapists || []) as TherapistOption[]
}

export async function assignTherapist(id: string, payload: AssignInput) {
  await axiosInstance.patch(`/admin/appointments/${id}/assign-therapist`, payload)
}

export async function confirmAppointment(id: string) {
  await axiosInstance.patch(`/admin/appointments/${id}/confirm`)
}

export async function rescheduleAppointment(id: string, payload: RescheduleInput) {
  await axiosInstance.patch(`/admin/appointments/${id}/reschedule`, payload)
}

export async function approveReschedule(id: string) {
  await axiosInstance.patch(`/admin/appointments/${id}/reschedule-request/approve`)
}

export async function declineReschedule(id: string, payload: DeclineInput) {
  await axiosInstance.patch(`/admin/appointments/${id}/reschedule-request/decline`, payload)
}

export async function cancelAppointment(id: string, payload: CancelInput) {
  await axiosInstance.patch(`/admin/appointments/${id}/cancel`, payload)
}

export async function sendAppointmentNotification(id: string, payload: NotifyInput) {
  await axiosInstance.post(`/admin/appointments/${id}/notification`, payload)
}

export async function completeAppointment(id: string) {
  await axiosInstance.patch(`/admin/appointments/${id}/complete`)
}

export async function markNoShow(id: string) {
  await axiosInstance.patch(`/admin/appointments/${id}/no-show`)
}

export async function listServices() {
  const response = await axiosInstance.get('/admin/services')
  return (response.data?.services || []) as AdminService[]
}

export async function createService(payload: ServiceInput) {
  const response = await axiosInstance.post('/admin/services', payload)
  return response.data?.service as AdminService
}

export async function updateService(id: string, payload: ServiceInput) {
  const response = await axiosInstance.patch(`/admin/services/${id}`, payload)
  return response.data?.service as AdminService
}

export async function retireService(id: string) {
  await axiosInstance.delete(`/admin/services/${id}`)
}

export async function listSessions(filters: SessionFilters = {}) {
  const response = await axiosInstance.get('/admin/sessions', { params: filters })
  return (response.data?.sessions || []) as SessionRecord[]
}

export async function listPayments(filters: PaymentFilters) {
  const response = await axiosInstance.get('/admin/payments', { params: filters })
  return (response.data?.appointments || []) as AdminAppointment[]
}

export async function recordPayment(id: string, payload: PaymentInput) {
  const response = await axiosInstance.post(`/admin/appointments/${id}/payment`, payload)
  return response.data?.appointment as AdminAppointment
}

export async function updatePayment(id: string, payload: PaymentUpdate) {
  const response = await axiosInstance.patch(`/admin/appointments/${id}/payment`, payload)
  return response.data?.appointment as AdminAppointment
}

export async function exportPayments(filters: PaymentFilters) {
  const response = await axiosInstance.get('/admin/reports/payments/export', {
    params: filters,
    responseType: 'blob',
  })
  return response.data as Blob
}

export async function getReports(params: { from?: string; to?: string }) {
  const response = await axiosInstance.get('/admin/reports', { params })
  return response.data as Reports
}

export async function updateProfile(payload: ProfileInput) {
  const response = await axiosInstance.patch('/auth/profile', payload)
  return (response.data?.user || response.data) as AuthUser
}
