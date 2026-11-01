import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

export type AppointmentTab = 'pending' | 'upcoming' | 'previous'
export const APPOINTMENTS_PER_PAGE = 10

export function useServices() {
  return useQuery({
    queryKey: keys.services.all,
    queryFn: api.listServices,
    staleTime: 5 * 60_000,
  })
}

export function useDependents() {
  return useQuery({ queryKey: keys.dependents.list(), queryFn: api.listDependents })
}

export function useDependent(id: string | undefined) {
  return useQuery({
    queryKey: keys.dependents.detail(id ?? ''),
    queryFn: () => api.getDependent(id as string),
    enabled: Boolean(id),
  })
}

export function useAppointments(status: AppointmentTab, page = 1) {
  return useQuery({
    queryKey: keys.appointments.list({ status, page }),
    queryFn: () => api.listAppointments(status, page),
  })
}

export function useAppointmentList(status: AppointmentTab) {
  return useInfiniteQuery({
    queryKey: [...keys.appointments.all, 'list', status],
    queryFn: ({ pageParam }) => api.listAppointments(status, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      pages.length * APPOINTMENTS_PER_PAGE < lastPage.total ? pages.length + 1 : undefined,
  })
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: keys.appointments.detail(id ?? ''),
    queryFn: () => api.getAppointment(id as string),
    enabled: Boolean(id),
  })
}

export function useSessions() {
  return useQuery({ queryKey: keys.sessions.all, queryFn: api.listSessions })
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: keys.sessions.detail(id ?? ''),
    queryFn: () => api.getSession(id as string),
    enabled: Boolean(id),
  })
}

export function useCalendarStatus() {
  return useQuery({
    queryKey: [...keys.calendar.all, 'status'] as const,
    queryFn: api.getCalendarStatus,
  })
}
