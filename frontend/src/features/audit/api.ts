import axiosInstance from '@/lib/api/client'

export type AuditEntry = {
  _id: string
  at: string
  actorId?: string
  actorName?: string
  actorRole?: string
  category: string
  action: string
  resourceType: string
  resourceId: string
  result: string
  source: string
  requestId?: string
  changes?: { field: string; before: unknown; after: unknown }[]
}
export type AuditFilters = {
  page: number
  search: string
  actor: string
  role: string
  category: string
  result: string
  from: string
  to: string
}
function params(filters: AuditFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))
}
export async function listAudit(filters: AuditFilters) {
  const response = await axiosInstance.get('/audit', { params: params(filters) })
  return response.data as {
    entries: AuditEntry[]
    pagination: { page: number; total: number; pages: number }
  }
}
export async function auditDetail(id: string) {
  return (await axiosInstance.get(`/audit/${encodeURIComponent(id)}`)).data.entry as AuditEntry
}
export async function exportAudit(filters: AuditFilters) {
  return (
    await axiosInstance.get('/audit/export', { params: params(filters), responseType: 'blob' })
  ).data as Blob
}
