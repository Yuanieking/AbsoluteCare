import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

export function useDocuments(filters) {
  return useQuery({
    queryKey: keys.documents.list(filters),
    queryFn: () => api.listDocuments(filters),
  })
}

export function useDocument(id) {
  return useQuery({
    queryKey: keys.documents.detail(id ?? ''),
    queryFn: () => api.getDocument(id),
    enabled: Boolean(id),
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => api.createDocument(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.documents.all }),
  })
}

export function useRetryDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.retryDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.documents.all }),
  })
}

export function useVerifyDocument(trackingNumber) {
  return useQuery({
    queryKey: keys.verify.detail(trackingNumber ?? ''),
    queryFn: () => api.verifyDocument(trackingNumber),
    enabled: Boolean(trackingNumber),
    retry: false,
  })
}

/** Turns the authenticated PDF response into a one-click download. */
export async function downloadDocument(document) {
  const blob = await api.downloadDocument(document.id)
  const url = URL.createObjectURL(blob)
  const link = documentLink()
  link.href = url
  link.download = `${document.trackingNumber}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

function documentLink() {
  const link = window.document.createElement('a')
  link.rel = 'noopener'
  return link
}
