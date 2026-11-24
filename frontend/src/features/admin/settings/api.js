import axiosInstance from '@/lib/api/client'

export async function getAdminSettings() {
  const response = await axiosInstance.get('/admin/settings')
  return {
    settings: response.data?.settings,
    integrations: response.data?.integrations ?? {},
  }
}

export async function updateSettingsSection(section, payload, timestamp) {
  const response = await axiosInstance.patch(`/admin/settings/${section}`, payload, {
    headers: timestamp ? { 'If-Match': `"${timestamp}"` } : undefined,
  })
  return response.data?.section
}

export async function getSettingsAudit() {
  const response = await axiosInstance.get('/admin/settings/audit')
  return response.data?.entries ?? []
}

export async function sendSettingsTestEmail() {
  const response = await axiosInstance.post('/admin/settings/test-email')
  return response.data?.message || 'Test email sent'
}

export async function getIntegrationHealth() {
  return (await axiosInstance.get('/admin/settings/integrations/health')).data
}

export async function getIntegrations() {
  return (await axiosInstance.get('/admin/settings/integrations')).data
}

export async function updateIntegration(key, payload) {
  const response = await axiosInstance.patch(`/admin/settings/integrations/${key}`, payload)
  return response.data
}

export async function testIntegration(key) {
  await axiosInstance.post(`/admin/settings/integrations/${key}/test`)
}

export async function confirmSettingsVerification(action, code) {
  const response = await axiosInstance.post('/admin/settings/verification/confirm', {
    action,
    code,
  })
  return response.data
}

export async function getIntegrationCredentials() {
  return (await axiosInstance.get('/admin/settings/integrations/credentials')).data
}

export async function requestCredentialVerification(payload) {
  const response = await axiosInstance.post(
    '/admin/settings/integrations/credentials/verification',
    payload,
  )
  return response.data
}

export async function saveIntegrationCredentials(payload) {
  const response = await axiosInstance.patch('/admin/settings/integrations/credentials', payload)
  return response.data
}

export async function resetIntegrationCredentials(verificationToken) {
  const response = await axiosInstance.post('/admin/settings/integrations/credentials/reset', {
    verificationToken,
    confirmKeyRotation: true,
  })
  return response.data
}

export async function clearIntegrationCredential(key, payload) {
  const response = await axiosInstance.post(
    `/admin/settings/integrations/credentials/${key}/clear`,
    payload,
  )
  return response.data
}

export async function rollbackIntegrationCredential(key, payload) {
  const response = await axiosInstance.post(
    `/admin/settings/integrations/credentials/${key}/rollback`,
    payload,
  )
  return response.data
}

export async function getDriveStatus() {
  return (await axiosInstance.get('/integrations/google-drive/status')).data
}

/** Fetches the clinic Drive consent redirect URL from the backend. */
export async function getDriveConnectRedirectUrl() {
  const response = await axiosInstance.get('/integrations/google-drive/connect')
  return response.data.redirectUrl
}

export async function disconnectDrive() {
  await axiosInstance.post('/integrations/google-drive/disconnect')
}

export async function testDriveConnection() {
  const response = await axiosInstance.post('/integrations/google-drive/test')
  return response.data
}

export async function restartServer() {
  const response = await axiosInstance.post('/admin/settings/integrations/restart')
  return response.data
}

/** Needs a verification token: the file contains credential material. */
export async function downloadBackup(verificationToken) {
  const response = await axiosInstance.post(
    '/admin/backup/export',
    { verificationToken },
    {
      responseType: 'blob',
    },
  )
  return response.data
}

/** Replaces the whole database. Requires maintenance mode server-side. */
export async function restoreBackup(file, verificationToken, confirmation) {
  const response = await axiosInstance.post('/admin/backup/restore', {
    backup: await file.text(),
    verificationToken,
    confirmation,
  })
  return response.data
}

export async function downloadHandoverPack() {
  const response = await axiosInstance.get('/admin/settings/integrations/handover', {
    responseType: 'blob',
  })
  return response.data
}
