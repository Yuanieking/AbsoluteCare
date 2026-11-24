import axiosInstance from '@/lib/api/client'

function params(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))
}
export async function listAudit(filters) {
  const response = await axiosInstance.get('/audit', { params: params(filters) })
  return response.data
}
export async function auditDetail(id) {
  return (await axiosInstance.get(`/audit/${encodeURIComponent(id)}`)).data.entry
}
export async function exportAudit(filters) {
  return (
    await axiosInstance.get('/audit/export', { params: params(filters), responseType: 'blob' })
  ).data
}
