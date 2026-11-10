import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

function useAdminInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    for (const queryKey of [
      keys.users.all,
      keys.appointments.all,
      keys.services.all,
      keys.sessions.all,
      keys.specializations.all,
      keys.payments.all,
      keys.reports.all,
      keys.therapists.all,
    ]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }
}

export function useCreateUser() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: api.createUser, onSuccess: invalidate })
}

export function useUpdateUser() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.UserInput & { id: string }) => api.updateUser(id, payload),
    onSuccess: invalidate,
  })
}

export function useSetUserActive() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setUserActive(id, active),
    onSuccess: invalidate,
  })
}

export function useArchiveUser() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: api.archiveUser, onSuccess: invalidate })
}

export function useRemoveUser() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, confirmName }: { id: string; confirmName: string }) =>
      api.removeUser(id, confirmName),
    onSuccess: invalidate,
  })
}

export function useSavePerson(role: 'patient' | 'therapist') {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({
      id,
      payload,
      customSpecializations = [],
    }: {
      id: string
      payload: Record<string, unknown> & { specialization?: string[] }
      /** Custom specializations to keep in the shared list, even when unchecked. */
      customSpecializations?: string[]
    }) =>
      role === 'patient'
        ? api.updatePatient(id, payload)
        : (async () => {
            const updated = await api.updateTherapist(id, payload)
            await api.updateTherapistSpecialization(id, payload.specialization ?? [])
            await api.registerSpecializations(customSpecializations)
            return updated
          })(),
    onSuccess: invalidate,
  })
}

export function useSaveTherapistAvailability() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.AvailabilityInput & { id: string }) =>
      api.updateTherapistAvailability(id, payload),
    onSuccess: invalidate,
  })
}

export function useSaveProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.me })
    },
  })
}

export function useSaveService() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.ServiceInput & { id?: string }) =>
      id ? api.updateService(id, payload) : api.createService(payload),
    onSuccess: invalidate,
  })
}

export function useRetireService() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: api.retireService, onSuccess: invalidate })
}

export function useAssignTherapist() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.AssignInput & { id: string }) =>
      api.assignTherapist(id, payload),
    onSuccess: invalidate,
  })
}

export function useConfirmAppointment() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: api.confirmAppointment, onSuccess: invalidate })
}

export function useRescheduleAppointment() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.RescheduleInput & { id: string }) =>
      api.rescheduleAppointment(id, payload),
    onSuccess: invalidate,
  })
}

export function useApproveReschedule() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: api.approveReschedule, onSuccess: invalidate })
}

export function useDeclineReschedule() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.DeclineInput & { id: string }) =>
      api.declineReschedule(id, payload),
    onSuccess: invalidate,
  })
}

export function useCancelAppointment() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.CancelInput & { id: string }) =>
      api.cancelAppointment(id, payload),
    onSuccess: invalidate,
  })
}

export function useSendAppointmentNotification() {
  return useMutation({
    mutationFn: ({ id, ...payload }: api.NotifyInput & { id: string }) =>
      api.sendAppointmentNotification(id, payload),
  })
}

export function useCompleteAppointment() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: api.completeAppointment, onSuccess: invalidate })
}

export function useMarkNoShow() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: api.markNoShow, onSuccess: invalidate })
}

export function useRecordPayment() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.PaymentInput & { id: string }) =>
      api.recordPayment(id, payload),
    onSuccess: invalidate,
  })
}

export function useUpdatePayment() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.PaymentUpdate & { id: string }) =>
      api.updatePayment(id, payload),
    onSuccess: invalidate,
  })
}
