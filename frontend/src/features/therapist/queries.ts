import { useQuery } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

const scope = { scope: 'therapist' } as const

export function useTherapistProfile() {
  return useQuery({ queryKey: keys.therapists.detail('me'), queryFn: api.getProfile })
}

export function useTherapistAppointments() {
  return useQuery({ queryKey: keys.appointments.list(scope), queryFn: api.listAppointments })
}

export function useTherapistAppointment(id: string | undefined) {
  return useQuery({
    queryKey: keys.appointments.detail(id ?? ''),
    queryFn: () => api.getAppointment(id as string),
    enabled: Boolean(id),
  })
}

export function useTherapistPatients() {
  return useQuery({ queryKey: keys.patients.list(scope), queryFn: api.listPatients })
}

export function useTherapistSessions() {
  return useQuery({ queryKey: keys.sessions.list(scope), queryFn: api.listSessions })
}

export function useTherapistCalendarStatus() {
  return useQuery({
    queryKey: [...keys.calendar.all, 'therapist-status'] as const,
    queryFn: api.getCalendarStatus,
  })
}
