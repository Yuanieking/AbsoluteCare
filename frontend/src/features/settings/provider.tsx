/* eslint-disable react-refresh/only-export-components -- context files intentionally export provider + hook together (Phase 1 S-04) */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getPublicSettings } from './api'

export type PublicSettings = {
  googleAuthEnabled: boolean
  patientRegistrationEnabled: boolean
  recaptchaEnabled: boolean
  recaptchaSiteKey: string
  onlineBookingEnabled: boolean
  maintenanceMode: boolean
  maintenanceMessage: string
  announcement: {
    enabled: boolean
    message: string
    type: string
    expiresAt: string | null
  }
  clinicName: string
  phone: string
  email: string
  termsVersion: string
  passwordMinLength: number
  currency: string
  timezone: string
}

type SettingsContextValue = {
  settings: PublicSettings
  loading: boolean
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export default SettingsContext

const defaults: PublicSettings = {
  googleAuthEnabled: false,
  patientRegistrationEnabled: true,
  recaptchaEnabled: false,
  recaptchaSiteKey: '',
  onlineBookingEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: '',
  announcement: { enabled: false, message: '', type: 'info', expiresAt: null },
  clinicName: 'AbsoluteCare Physical Therapy',
  phone: '',
  email: '',
  termsVersion: '1.0',
  passwordMinLength: 8,
  currency: 'PHP',
  timezone: 'Asia/Manila',
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults)
  const [loading, setLoading] = useState(true)

  const refreshSettings = useCallback(async () => {
    try {
      const response = await getPublicSettings()
      const data = response.data as Partial<PublicSettings>
      setSettings((current) => ({
        ...current,
        ...data,
        recaptchaSiteKey: data.recaptchaEnabled ? data.recaptchaSiteKey || '' : '',
      }))
    } catch {
      setSettings(defaults)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(refreshSettings, 0)
    const interval = window.setInterval(refreshSettings, 180000)
    window.addEventListener('focus', refreshSettings)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(request)
      window.removeEventListener('focus', refreshSettings)
    }
  }, [refreshSettings])

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used inside a SettingsProvider')
  }
  return context
}
