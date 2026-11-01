import axiosInstance from '@/lib/api/client'
import type { SecretaryAppointment, SecretaryProfile, TherapistOption } from './types'

export type ScheduleFilters = { status: string; date: string; therapist: string }

export type PaymentInput = {
  amount: number
  method: string
  referenceNumber: string
  notes: string
  reason?: string
}

export type PaymentUpdate = PaymentInput & { status: 'paid' | 'unpaid' }

export type ProfileInput = {
  firstname: string
  lastname: string
  phone: string
  profilePicture: string
}

export async function getSchedule(filters: ScheduleFilters) {
  const response = await axiosInstance.get('/secretary/schedule', { params: filters })
  return {
    appointments: (response.data?.appointments || []) as SecretaryAppointment[],
    therapists: (response.data?.therapists || []) as TherapistOption[],
  }
}

export async function getAppointment(id: string) {
  const response = await axiosInstance.get(`/secretary/appointments/${id}`)
  return response.data?.appointment as SecretaryAppointment
}

export async function listPayments(status: string) {
  const response = await axiosInstance.get('/secretary/payments', {
    params: status === 'all' ? {} : { status },
  })
  return (response.data?.appointments || []) as SecretaryAppointment[]
}

export async function recordPayment(id: string, payload: PaymentInput) {
  const response = await axiosInstance.post(`/secretary/appointments/${id}/payment`, payload)
  return response.data?.appointment as SecretaryAppointment
}

export async function updatePayment(id: string, payload: PaymentUpdate) {
  const response = await axiosInstance.patch(`/secretary/appointments/${id}/payment`, payload)
  return response.data?.appointment as SecretaryAppointment
}

export async function getProfile() {
  const response = await axiosInstance.get('/secretary/profile')
  return response.data?.profile as SecretaryProfile
}

export async function updateProfile(payload: ProfileInput) {
  const response = await axiosInstance.patch('/secretary/profile', payload)
  return response.data?.profile as SecretaryProfile
}
