import axiosInstance from '@/lib/api/client'
import type { DocumentList, GeneratedDocument, VerifyResult } from './types'

export type CreateDocumentInput =
  | { type: 'clinic_report'; from: string; to: string }
  | {
      type: 'patient_summary'
      patientId: string
      dependentId?: string
      from: string
      to: string
    }
  | { type: 'visit_record'; appointmentId: string }
  | { type: 'receipt'; appointmentId: string }

export type DocumentFilters = {
  type?: string
  driveStatus?: string
  status?: string
  patientId?: string
  appointmentId?: string
  search?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export async function createDocument(input: CreateDocumentInput) {
  const response = await axiosInstance.post('/documents', input)
  return response.data?.document as GeneratedDocument
}

export async function listDocuments(filters: DocumentFilters = {}) {
  const response = await axiosInstance.get('/documents', { params: filters })
  return response.data as DocumentList
}

export async function getDocument(id: string) {
  const response = await axiosInstance.get(`/documents/${id}`)
  return response.data?.document as GeneratedDocument
}

export async function downloadDocument(id: string) {
  const response = await axiosInstance.get(`/documents/${id}/file`, {
    responseType: 'blob',
  })
  return response.data as Blob
}

export async function retryDocument(id: string) {
  const response = await axiosInstance.post(`/documents/${id}/retry`)
  return response.data?.document as GeneratedDocument
}

export async function revokeDocument(id: string, reason: string) {
  const response = await axiosInstance.post(`/documents/${id}/revoke`, { reason })
  return response.data?.document as GeneratedDocument
}

/** Public route: it never returns 401, and an unknown number is a 404 body. */
export async function verifyDocument(trackingNumber: string) {
  const response = await axiosInstance.get<VerifyResult>(
    `/verify/${encodeURIComponent(trackingNumber)}`,
    { validateStatus: (status) => status === 200 || status === 404 },
  )
  return response.data
}
