import axiosInstance from '@/lib/api/client'
import type {
  AdminSettings,
  AuditEntry,
  CredentialsResponse,
  DriveConnectionStatus,
  IntegrationFlags,
  IntegrationHealth,
  SettingsSectionKey,
} from './types'

export async function getAdminSettings() {
  const response = await axiosInstance.get('/admin/settings')
  return {
    settings: response.data?.settings as AdminSettings,
    integrations: (response.data?.integrations ?? {}) as IntegrationFlags,
  }
}

export async function updateSettingsSection(section: SettingsSectionKey, payload: unknown) {
  const response = await axiosInstance.patch(`/admin/settings/${section}`, payload)
  return response.data?.section as unknown
}

export async function getSettingsAudit() {
  const response = await axiosInstance.get('/admin/settings/audit')
  return (response.data?.entries ?? []) as AuditEntry[]
}

export async function sendSettingsTestEmail() {
  const response = await axiosInstance.post('/admin/settings/test-email')
  return (response.data?.message as string) || 'Test email sent'
}

export async function getIntegrationHealth() {
  return (await axiosInstance.get('/admin/settings/integrations/health')).data as IntegrationHealth
}

export async function getIntegrations() {
  return (await axiosInstance.get('/admin/settings/integrations')).data as {
    key: string
    enabled?: boolean
  }[]
}

export async function updateIntegration(
  key: string,
  payload: { enabled: boolean; verificationToken?: string },
) {
  const response = await axiosInstance.patch(`/admin/settings/integrations/${key}`, payload)
  return response.data as { enabled: boolean }
}

export async function testIntegration(key: string) {
  await axiosInstance.post(`/admin/settings/integrations/${key}/test`)
}

export async function confirmSettingsVerification(action: string, code: string) {
  const response = await axiosInstance.post('/admin/settings/verification/confirm', {
    action,
    code,
  })
  return response.data as { verificationToken: string }
}

export async function getIntegrationCredentials() {
  return (await axiosInstance.get('/admin/settings/integrations/credentials'))
    .data as CredentialsResponse
}

export async function requestCredentialVerification(payload: {
  action: string
  values?: Record<string, string>
  confirmKeyRotation?: boolean
}) {
  const response = await axiosInstance.post(
    '/admin/settings/integrations/credentials/verification',
    payload,
  )
  return response.data as { maskedEmail?: string }
}

export async function saveIntegrationCredentials(payload: {
  group: string
  values?: Record<string, string>
  verificationToken?: string
  confirmKeyRotation?: boolean
}) {
  const response = await axiosInstance.patch('/admin/settings/integrations/credentials', payload)
  return response.data as CredentialsResponse
}

export async function clearIntegrationCredential(
  key: string,
  payload: { verificationToken: string },
) {
  const response = await axiosInstance.post(
    `/admin/settings/integrations/credentials/${key}/clear`,
    payload,
  )
  return response.data as CredentialsResponse
}

export async function rollbackIntegrationCredential(
  key: string,
  payload: { verificationToken: string },
) {
  const response = await axiosInstance.post(
    `/admin/settings/integrations/credentials/${key}/rollback`,
    payload,
  )
  return response.data as CredentialsResponse
}

export async function getDriveStatus() {
  return (await axiosInstance.get('/integrations/google-drive/status'))
    .data as DriveConnectionStatus
}

/** Opening this URL starts the clinic Drive consent flow and returns here. */
export function driveConnectUrl() {
  return `${axiosInstance.defaults.baseURL}/integrations/google-drive/connect`
}

export async function disconnectDrive() {
  await axiosInstance.post('/integrations/google-drive/disconnect')
}

export async function testDriveConnection() {
  const response = await axiosInstance.post('/integrations/google-drive/test')
  return response.data as { ok: boolean; message: string; fileName?: string }
}

export async function restartServer() {
  const response = await axiosInstance.post('/admin/settings/integrations/restart')
  return response.data as { code?: string; command?: string }
}

export async function downloadHandoverPack() {
  const response = await axiosInstance.get('/admin/settings/integrations/handover', {
    responseType: 'blob',
  })
  return response.data as Blob
}
