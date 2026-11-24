import axiosInstance from '@/lib/api/client'

export const getPublicSettings = () => axiosInstance.get('/settings/public')
