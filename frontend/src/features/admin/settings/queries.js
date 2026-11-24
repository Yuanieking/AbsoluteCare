import { useQuery } from '@tanstack/react-query'
import { keys } from '@/lib/api/keys'
import * as api from './api'

async function loadBundle() {
  const [settings, health, credentials] = await Promise.allSettled([
    api.getAdminSettings(),
    api.getIntegrationHealth(),
    api.getIntegrationCredentials(),
  ])
  if (settings.status === 'rejected') throw settings.reason
  return {
    settings: settings.value,
    health: health.status === 'fulfilled' ? health.value : {},
    credentials: credentials.status === 'fulfilled' ? credentials.value : null,
  }
}

export function useSettingsBundle() {
  return useQuery({
    queryKey: keys.settings.list({ scope: 'admin', section: 'all' }),
    queryFn: loadBundle,
  })
}
