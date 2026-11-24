import axiosInstance from '@/lib/api/client'

export async function createDocument(input) {
  const response = await axiosInstance.post('/documents', input)
  return response.data?.document
}

export async function listDocuments(filters = {}) {
  const response = await axiosInstance.get('/documents', { params: filters })
  return response.data
}

export async function getDocument(id) {
  const response = await axiosInstance.get(`/documents/${id}`)
  return response.data?.document
}

export async function downloadDocument(id) {
  const response = await axiosInstance.get(`/documents/${id}/file`, {
    responseType: 'blob',
  })
  return response.data
}

export async function retryDocument(id) {
  const response = await axiosInstance.post(`/documents/${id}/retry`)
  return response.data?.document
}

export async function revokeDocument(id, reason) {
  const response = await axiosInstance.post(`/documents/${id}/revoke`, { reason })
  return response.data?.document
}

/** Public route: it never returns 401, and an unknown number is a 404 body. */
export async function verifyDocument(trackingNumber) {
  const response = await axiosInstance.get(`/verify/${encodeURIComponent(trackingNumber)}`, {
    validateStatus: (status) => status === 200 || status === 404,
  })
  return response.data
}
