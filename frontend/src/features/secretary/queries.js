import { useQuery } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

export function useSecretarySchedule(filters) {
  return useQuery({
    queryKey: keys.appointments.list({ scope: 'secretary', ...filters }),
    queryFn: () => api.getSchedule(filters),
  })
}

export function useSecretaryPayments(status) {
  return useQuery({
    queryKey: keys.payments.list({ scope: 'secretary', status }),
    queryFn: () => api.listPayments(status),
  })
}

export function useSecretaryAppointment(id) {
  return useQuery({
    queryKey: keys.appointments.detail(id ?? ''),
    queryFn: () => api.getAppointment(id),
    enabled: Boolean(id),
  })
}

export function useSecretaryProfile() {
  return useQuery({ queryKey: keys.users.detail('me'), queryFn: api.getProfile })
}
