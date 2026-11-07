import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'
import type { CreateDocumentInput, DocumentFilters } from './api'
import type { GeneratedDocument } from './types'

export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: keys.documents.list(filters),
    queryFn: () => api.listDocuments(filters),
  })
}

export function useDocument(id: string | null) {
  return useQuery({
    queryKey: keys.documents.detail(id ?? ''),
    queryFn: () => api.getDocument(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDocumentInput) => api.createDocument(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.documents.all }),
  })
}

export function useRetryDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.retryDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.documents.all }),
  })
}

export function useVerifyDocument(trackingNumber: string | undefined) {
  return useQuery({
    queryKey: keys.verify.detail(trackingNumber ?? ''),
    queryFn: () => api.verifyDocument(trackingNumber as string),
    enabled: Boolean(trackingNumber),
    retry: false,
  })
}

/** Turns the authenticated PDF response into a one-click download. */
export async function downloadDocument(document: GeneratedDocument) {
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
