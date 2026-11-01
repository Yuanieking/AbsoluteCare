import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/session'
import { NotificationsProvider } from '@/features/notifications/provider'
import { SettingsProvider } from '@/features/settings/provider'
import { queryClient } from '@/lib/api/query-client'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <NotificationsProvider>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              expand={false}
              visibleToasts={4}
              theme="light"
            />
          </NotificationsProvider>
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}
