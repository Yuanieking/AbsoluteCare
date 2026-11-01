import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

function useInvalidate() {
  const queryClient = useQueryClient()
  return (queryKey: readonly unknown[]) => queryClient.invalidateQueries({ queryKey })
}

export function useBookAppointment() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.bookAppointment,
    onSuccess: () => {
      void invalidate(keys.appointments.all)
      void invalidate(keys.notifications.all)
    },
  })
}

export function useRequestReschedule() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.RescheduleInput & { id: string }) =>
      api.requestReschedule(id, payload),
    onSuccess: (_data, variables) => {
      void invalidate(keys.appointments.all)
      void invalidate(keys.appointments.detail(variables.id))
      void invalidate(keys.notifications.all)
    },
  })
}

export function useCancelAppointment() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.cancelAppointment(id),
    onSuccess: (_data, id) => {
      void invalidate(keys.appointments.all)
      void invalidate(keys.appointments.detail(id))
      void invalidate(keys.notifications.all)
    },
  })
}

export function useSyncCalendar() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.syncAppointmentCalendar,
    onSuccess: (_data, id) => {
      void invalidate(keys.appointments.detail(id))
    },
  })
}

export function useSaveDependent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.DependentInput & { id?: string }) =>
      id ? api.updateDependent(id, payload) : api.createDependent(payload),
    onSuccess: () => {
      void invalidate(keys.dependents.all)
      void invalidate(keys.me)
    },
  })
}

export function useRemoveDependent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.removeDependent,
    onSuccess: () => {
      void invalidate(keys.dependents.all)
      void invalidate(keys.me)
    },
  })
}

export function useDisconnectCalendar() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.disconnectCalendar,
    onSuccess: () => {
      void invalidate([...keys.calendar.all, 'status'])
    },
  })
}

export function useSaveProfile() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () => {
      void invalidate(keys.me)
    },
  })
}
