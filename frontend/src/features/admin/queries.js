import { useQuery } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

const scope = { scope: 'admin' }

export function useAdminUsers(filters) {
  return useQuery({
    queryKey: keys.users.list({ ...scope, ...filters }),
    queryFn: () => api.userApi.listUsers(filters),
  })
}

export function useAdminAppointments(filters, refetchInterval) {
  return useQuery({
    queryKey: keys.appointments.list({ ...scope, ...filters }),
    queryFn: () => api.listAppointments(filters),
    refetchInterval,
  })
}

export function useDashboardAppointments(filters) {
  return useAdminAppointments(filters)
}

export function useAvailableTherapists(appointmentId) {
  return useQuery({
    queryKey: [...keys.therapists.all, 'available', appointmentId ?? ''],
    queryFn: () => api.availableTherapists(appointmentId),
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

export function useAdminSessions(filters = {}) {
  return useQuery({
    queryKey: keys.sessions.list({ ...scope, ...filters }),
    queryFn: () => api.listSessions(filters),
  })
}

export function useAdminPayments(filters) {
  return useQuery({
    queryKey: keys.payments.list({ ...scope, ...filters }),
    queryFn: () => api.listPayments(filters),
  })
}

export function useAdminReports(params) {
  return useQuery({
    queryKey: keys.reports.list({ ...scope, from: params.from, to: params.to }),
    queryFn: () => api.getReports(params),
  })
}
