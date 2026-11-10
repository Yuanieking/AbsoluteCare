import { useQuery } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'
import type { AppointmentFilters, PaymentFilters, SessionFilters, UserListFilters } from './types'

const scope = { scope: 'admin' } as const

export function useAdminUsers(filters: UserListFilters) {
  return useQuery({
    queryKey: keys.users.list({ ...scope, ...filters }),
    queryFn: () => api.userApi.listUsers(filters),
  })
}

export function useAdminAppointments(filters: AppointmentFilters, refetchInterval?: number) {
  return useQuery({
    queryKey: keys.appointments.list({ ...scope, ...filters }),
    queryFn: () => api.listAppointments(filters),
    refetchInterval,
  })
}

export function useDashboardAppointments(filters: AppointmentFilters) {
  return useAdminAppointments(filters)
}

export function useAvailableTherapists(appointmentId: string | null) {
  return useQuery({
    queryKey: [...keys.therapists.all, 'available', appointmentId ?? ''] as const,
    queryFn: () => api.availableTherapists(appointmentId as string),
    enabled: Boolean(appointmentId),
  })
}

export function useAdminServices() {
  return useQuery({ queryKey: keys.services.list(scope), queryFn: api.listServices })
}

export function useSpecializationCatalog(enabled = true) {
  return useQuery({
    queryKey: keys.specializations.list(scope),
    queryFn: api.listSpecializations,
    enabled,
  })
}

export function useAdminSessions(filters: SessionFilters = {}) {
  return useQuery({
    queryKey: keys.sessions.list({ ...scope, ...filters }),
    queryFn: () => api.listSessions(filters),
  })
}

export function useAdminPayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: keys.payments.list({ ...scope, ...filters }),
    queryFn: () => api.listPayments(filters),
  })
}

export function useAdminReports(params: { from: string; to: string }) {
  return useQuery({
    queryKey: keys.reports.list({ ...scope, from: params.from, to: params.to }),
    queryFn: () => api.getReports(params),
  })
}
