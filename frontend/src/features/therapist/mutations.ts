import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

function useTherapistInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    for (const queryKey of [
      keys.appointments.all,
      keys.patients.all,
      keys.sessions.all,
      keys.therapists.all,
      keys.notifications.all,
    ]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }
}

export function useRequestReschedule() {
  const invalidate = useTherapistInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.RescheduleInput & { id: string }) =>
      api.requestReschedule(id, payload),
    onSuccess: invalidate,
  })
}

export function useMarkNoShow() {
  const invalidate = useTherapistInvalidation()
  return useMutation({ mutationFn: api.markNoShow, onSuccess: invalidate })
}

export function useCreateSession() {
  const invalidate = useTherapistInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.SessionInput & { id: string }) =>
      api.createSession(id, payload),
    onSuccess: invalidate,
  })
}

export function useUpdateSession() {
  const invalidate = useTherapistInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.SessionInput & { id: string }) =>
      api.updateSession(id, payload),
    onSuccess: invalidate,
  })
}

export function useSaveAvailability() {
  const invalidate = useTherapistInvalidation()
  return useMutation({ mutationFn: api.updateAvailability, onSuccess: invalidate })
}

export function useSaveTherapistProfile() {
  const invalidate = useTherapistInvalidation()
  return useMutation({ mutationFn: api.updateProfile, onSuccess: invalidate })
}

export function useDisconnectCalendar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.disconnectCalendar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...keys.calendar.all, 'therapist-status'] })
    },
  })
}
