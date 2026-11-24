import axiosInstance from '@/lib/api/client'

async function listUsers(filters) {
  const response = await axiosInstance.get('/admin/users', { params: filters })
  return {
    users: response.data?.users || [],
    pagination: response.data?.pagination,
  }
}

export async function createUser(payload) {
  const response = await axiosInstance.post('/admin/users', payload)
  return response.data
}

export async function updateUser(id, payload) {
  const response = await axiosInstance.patch(`/admin/users/${id}`, payload)
  return response.data?.user
}

export async function setUserActive(id, active) {
  const response = await axiosInstance.patch(
    `/admin/users/${id}/${active ? 'activate' : 'deactivate'}`,
  )
  return response.data?.user
}

export async function archiveUser(id) {
  const response = await axiosInstance.patch(`/admin/users/${id}/archive`)
  return response.data?.user
}

export async function removeUser(id, confirmName) {
  await axiosInstance.delete(`/admin/users/${id}`, { data: { confirmName } })
}

export const userApi = { listUsers, createUser, updateUser, setUserActive, archiveUser, removeUser }

export async function updatePatient(id, payload) {
  const response = await axiosInstance.patch(`/admin/patients/${id}`, payload)
  return response.data?.user
}

export async function updateTherapist(id, payload) {
  const response = await axiosInstance.patch(`/admin/therapists/${id}`, payload)
  return response.data?.user
}

export async function updateTherapistSpecialization(id, specialization) {
  await axiosInstance.patch(`/admin/therapists/${id}/specialization`, { specialization })
}

export async function listSpecializations() {
  const response = await axiosInstance.get('/admin/specializations')
  return response.data?.specializations || []
}

export async function registerSpecializations(names) {
  const response = await axiosInstance.post('/admin/specializations', { names })
  return response.data?.specializations || []
}

export async function updateTherapistAvailability(id, payload) {
  const response = await axiosInstance.patch(`/admin/therapists/${id}/working-days`, payload)
  return response.data?.user
}

export async function listAppointments(filters) {
  const response = await axiosInstance.get('/admin/appointments', { params: filters })
  return {
    appointments: response.data?.appointments || [],
    pagination: response.data?.pagination || { page: 1, pages: 1 },
  }
}

export async function availableTherapists(id) {
  const response = await axiosInstance.get(`/admin/appointments/${id}/available-therapists`)
  return response.data?.therapists || []
}

export async function assignTherapist(id, payload) {
  await axiosInstance.patch(`/admin/appointments/${id}/assign-therapist`, payload)
}

export async function confirmAppointment(id) {
  await axiosInstance.patch(`/admin/appointments/${id}/confirm`)
}

export async function rescheduleAppointment(id, payload) {
  await axiosInstance.patch(`/admin/appointments/${id}/reschedule`, payload)
}

export async function approveReschedule(id) {
  await axiosInstance.patch(`/admin/appointments/${id}/reschedule-request/approve`)
}

export async function declineReschedule(id, payload) {
  await axiosInstance.patch(`/admin/appointments/${id}/reschedule-request/decline`, payload)
}

export async function cancelAppointment(id, payload) {
  await axiosInstance.patch(`/admin/appointments/${id}/cancel`, payload)
}

export async function sendAppointmentNotification(id, payload) {
  await axiosInstance.post(`/admin/appointments/${id}/notification`, payload)
}

export async function completeAppointment(id) {
  await axiosInstance.patch(`/admin/appointments/${id}/complete`)
}

export async function markNoShow(id) {
  await axiosInstance.patch(`/admin/appointments/${id}/no-show`)
}

export async function listServices() {
  const response = await axiosInstance.get('/admin/services')
  return response.data?.services || []
}

export async function createService(payload) {
  const response = await axiosInstance.post('/admin/services', payload)
  return response.data?.service
}

export async function updateService(id, payload) {
  const response = await axiosInstance.patch(`/admin/services/${id}`, payload)
  return response.data?.service
}

export async function retireService(id) {
  await axiosInstance.delete(`/admin/services/${id}`)
}

export async function listSessions(filters = {}) {
  const response = await axiosInstance.get('/admin/sessions', { params: filters })
  return response.data?.sessions || []
}

export async function listPayments(filters) {
  const response = await axiosInstance.get('/admin/payments', { params: filters })
  return response.data?.appointments || []
}

export async function recordPayment(id, payload) {
  const response = await axiosInstance.post(`/admin/appointments/${id}/payment`, payload)
  return response.data?.appointment
}

export async function updatePayment(id, payload) {
  const response = await axiosInstance.patch(`/admin/appointments/${id}/payment`, payload)
  return response.data?.appointment
}

export async function exportPayments(filters) {
  const response = await axiosInstance.get('/admin/reports/payments/export', {
    params: filters,
    responseType: 'blob',
  })
  return response.data
}

export async function getReports(params) {
  const response = await axiosInstance.get('/admin/reports', { params })
  return response.data
}

export async function updateProfile(payload) {
  const response = await axiosInstance.patch('/auth/profile', payload)
  return response.data?.user || response.data
}
