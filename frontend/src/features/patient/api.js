import axiosInstance from '@/lib/api/client'

export async function getProfile() {
  const response = await axiosInstance.get('/auth/me')
  return response.data?.user || response.data
}

export async function updateProfile(payload) {
  const response = await axiosInstance.patch('/auth/profile', payload)
  return response.data?.user || response.data
}

export async function listServices() {
  const response = await axiosInstance.get('/services')
  return response.data?.services || []
}

export async function listBookingTimes(service, date) {
  const response = await axiosInstance.get('/availability', { params: { service, date } })
  return response.data?.times || []
}

export async function listDependents() {
  const response = await axiosInstance.get('/dependents')
  return response.data?.dependents || []
}

export async function getDependent(id) {
  const response = await axiosInstance.get(`/dependents/${id}`)
  return response.data
}

export async function createDependent(payload) {
  const response = await axiosInstance.post('/dependents', payload)
  return response.data?.dependent
}

export async function updateDependent(id, payload) {
  const response = await axiosInstance.patch(`/dependents/${id}`, payload)
  return response.data?.dependent
}

export async function removeDependent(id) {
  await axiosInstance.delete(`/dependents/${id}`)
}

export async function bookAppointment(payload) {
  const response = await axiosInstance.post('/appointments', payload)
  return response.data?.appointment
}

export async function listAppointments(status, page = 1) {
  const response = await axiosInstance.get('/appointments', { params: { status, page } })
  return {
    appointments: response.data?.appointments || [],
    total: Number(response.data?.total || 0),
  }
}

export async function getAppointment(id) {
  const response = await axiosInstance.get(`/appointments/${id}`)
  return response.data?.appointment || null
}

export async function requestReschedule(id, payload) {
  const response = await axiosInstance.post(`/appointments/${id}/reschedule-request`, payload)
  return response.data?.appointment || null
}

export async function cancelAppointment(id, reason) {
  const response = await axiosInstance.post(`/appointments/${id}/cancel`, { reason })
  return response.data?.appointment || null
}

export async function syncAppointmentCalendar(id) {
  const response = await axiosInstance.post(`/appointments/${id}/calendar-sync`)
  return response.data
}

export async function listSessions() {
  const response = await axiosInstance.get('/sessions')
  return response.data?.sessions || []
}

export async function getSession(id) {
  const response = await axiosInstance.get(`/sessions/${id}`)
  return response.data?.session || null
}

export async function getCalendarStatus() {
  const response = await axiosInstance.get('/integrations/google-calendar/status')
  return response.data
}

export async function disconnectCalendar() {
  await axiosInstance.post('/integrations/google-calendar/disconnect')
}

export async function getCalendarConnectRedirectUrl() {
  const response = await axiosInstance.get('/integrations/google-calendar/connect')
  return response.data.redirectUrl
}
