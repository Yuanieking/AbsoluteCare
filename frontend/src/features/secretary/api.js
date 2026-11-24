import axiosInstance from '@/lib/api/client'

export async function getSchedule(filters) {
  const response = await axiosInstance.get('/secretary/schedule', { params: filters })
  return {
    appointments: response.data?.appointments || [],
    therapists: response.data?.therapists || [],
  }
}

export async function getAppointment(id) {
  const response = await axiosInstance.get(`/secretary/appointments/${id}`)
  return response.data?.appointment
}

export async function listPayments(status) {
  const response = await axiosInstance.get('/secretary/payments', {
    params: status === 'all' ? {} : { status },
  })
  return response.data?.appointments || []
}

export async function recordPayment(id, payload) {
  const response = await axiosInstance.post(`/secretary/appointments/${id}/payment`, payload)
  return response.data?.appointment
}

export async function updatePayment(id, payload) {
  const response = await axiosInstance.patch(`/secretary/appointments/${id}/payment`, payload)
  return response.data?.appointment
}

export async function getProfile() {
  const response = await axiosInstance.get('/secretary/profile')
  return response.data?.profile
}

export async function updateProfile(payload) {
  const response = await axiosInstance.patch('/secretary/profile', payload)
  return response.data?.profile
}
