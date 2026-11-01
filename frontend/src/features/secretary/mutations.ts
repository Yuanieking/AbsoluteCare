import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

function useSecretaryInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    for (const queryKey of [keys.appointments.all, keys.payments.all, keys.users.all]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }
}

export function useRecordPayment() {
  const invalidate = useSecretaryInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.PaymentInput & { id: string }) =>
      api.recordPayment(id, payload),
    onSuccess: invalidate,
  })
}

export function useUpdatePayment() {
  const invalidate = useSecretaryInvalidation()
  return useMutation({
    mutationFn: ({ id, ...payload }: api.PaymentUpdate & { id: string }) =>
      api.updatePayment(id, payload),
    onSuccess: invalidate,
  })
}

export function useSaveSecretaryProfile() {
  const invalidate = useSecretaryInvalidation()
  return useMutation({ mutationFn: api.updateProfile, onSuccess: invalidate })
}
