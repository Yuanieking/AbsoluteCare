import axiosInstance from '@/lib/api/client'

export async function getProfile() {
  const response = await axiosInstance.get('/therapist/profile')
  return response.data?.profile
}

export async function updateProfile(payload) {
  const response = await axiosInstance.patch('/therapist/profile', payload)
  return response.data?.profile
}

export async function updateAvailability(payload) {
  const response = await axiosInstance.patch('/therapist/availability', payload)
  return response.data?.profile
}

export async function listAppointments() {
  const response = await axiosInstance.get('/therapist/appointments')
  return response.data?.appointments || []
}

export async function getAppointment(id) {
  const response = await axiosInstance.get(`/therapist/appointments/${id}`)
  return response.data?.appointment
}

export async function requestReschedule(id, payload) {
  const response = await axiosInstance.post(
    `/therapist/appointments/${id}/reschedule-request`,
    payload,
  )
  return response.data?.appointment
}

export async function markNoShow(id) {
  const response = await axiosInstance.patch(`/therapist/appointments/${id}/no-show`)
  return response.data?.appointment
}

export async function createSession(id, payload) {
  const response = await axiosInstance.post(`/therapist/appointments/${id}/session`, payload)
  return response.data?.session
}

export async function listPatients() {
  const response = await axiosInstance.get('/therapist/patients')
  return response.data?.patients || []
}

export async function listSessions() {
  const response = await axiosInstance.get('/therapist/sessions')
  return response.data?.sessions || []
}

export async function updateSession(id, payload) {
  const response = await axiosInstance.patch(`/therapist/sessions/${id}`, payload)
  return response.data?.session
}

export async function getCalendarStatus() {
  const response = await axiosInstance.get('/integrations/google-calendar/therapist-status')
  return response.data
}

export async function disconnectCalendar() {
  await axiosInstance.post('/integrations/google-calendar/therapist-disconnect')
}

export async function getCalendarConnectRedirectUrl() {
  const response = await axiosInstance.get('/integrations/google-calendar/therapist-connect')
  return response.data.redirectUrl
}
